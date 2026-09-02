// =========================================================================
// authentifizierung
// =========================================================================
// bewusst ohne zusaetzliche abhaengigkeit: das passwort-hashing macht scrypt
// aus dem node-standard (crypto). scrypt ist speicherhart und damit gegen
// grafikkarten-angriffe ausgelegt — fuer diesen zweck genauso geeignet wie
// argon2 oder bcrypt, kostet aber kein natives modul, das beim aufsetzen
// wieder gebaut werden muesste.
//
// die session ist ein zufallstoken im cookie. in der datenbank liegt nur
// dessen sha-256-hash, ein datenbank-leck ergibt also keine gueltige session.

import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db.js';
import { config } from './config.js';

const scrypt = promisify(crypto.scrypt);

// bewusst teuer: ~100 ms und 32 MB arbeitsspeicher pro versuch
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 64, maxmem: 96 * 1024 * 1024 };

/* ---- passwoerter --------------------------------------------------------- */

export async function hashPassword(password) {
  const salt = crypto.randomBytes(32);
  const key = await scrypt(password.normalize('NFKC'), salt, SCRYPT.keylen, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, salt, key] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;

    const expected = Buffer.from(key, 'base64');
    const actual = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64'), expected.length, {
      N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem,
    });
    // konstante laufzeit, damit die dauer nichts ueber das passwort verraet
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/* ---- sessions ------------------------------------------------------------ */

export const COOKIE = 'lw_session';
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const insertSession = db.prepare(`
  INSERT INTO sessions (token_hash, user_id, csrf, expires_at)
  VALUES (?, ?, ?, datetime('now', ?))
`);
const selectSession = db.prepare(`
  SELECT s.token_hash, s.user_id, s.csrf, s.expires_at, u.username
  FROM sessions s JOIN users u ON u.id = s.user_id
  WHERE s.token_hash = ? AND s.expires_at > datetime('now')
`);
const deleteSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
const extendSession = db.prepare(
  "UPDATE sessions SET expires_at = datetime('now', ?) WHERE token_hash = ?"
);
const deleteExpired = db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')");
const touchLogin = db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?");

export function createSession(userId) {
  deleteExpired.run();
  const token = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(32).toString('base64url');
  insertSession.run(sha256(token), userId, csrf, `+${config.sessionDays} days`);
  touchLogin.run(userId);
  return { token, csrf };
}

export function readSession(token) {
  if (!token) return null;
  const hash = sha256(token);
  const session = selectSession.get(hash);
  if (!session) return null;

  /* gleitende gueltigkeit: laeuft die session in weniger als der haelfte
     ihrer laufzeit ab, wird sie verlaengert. wer die seite regelmaessig
     benutzt, muss sich damit nie wieder anmelden — anders als bei einer
     festen frist, die auch mitten in der arbeit ablaufen kann. */
  const half = config.sessionDays * 12 * 60 * 60 * 1000;
  if (new Date(session.expires_at + 'Z').getTime() - Date.now() < half) {
    extendSession.run(`+${config.sessionDays} days`, hash);
    session.renewed = true;
  }
  return session;
}

export function destroySession(token) {
  if (token) deleteSession.run(sha256(token));
}

export function cookieOptions() {
  return {
    httpOnly: true,                 // kein zugriff aus javascript
    sameSite: 'lax',                // blockt klassisches CSRF schon im browser
    secure: config.isProd,          // nur ueber https — lokal waere das hinderlich
    path: '/',
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
  };
}

/* ---- middleware ---------------------------------------------------------- */

// haengt req.session an, wenn ein gueltiges cookie mitkommt
export function withSession(req, res, next) {
  req.session = readSession(req.cookies?.[COOKIE]);
  next();
}

// riegelt eine route ab
export function requireAuth(req, res, next) {
  if (req.session) return next();

  // req.path ist innerhalb eines mount-points relativ ("/posts" statt
  // "/api/admin/posts") — fuer die unterscheidung seite/api muss deshalb
  // originalUrl herhalten, sonst bekaeme ein api-aufruf einen redirect.
  const isApi = req.originalUrl.startsWith('/api/');
  if (!isApi && req.accepts('html')) return res.redirect('/login/');
  res.status(401).json({ error: 'nicht angemeldet' });
}

// zweite verteidigungslinie neben sameSite=lax: jede schreibende anfrage muss
// das csrf-token der session als header mitschicken. ein fremdes formular
// kann diesen header nicht setzen.
export function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = req.get('X-CSRF-Token');
  if (!req.session || !sent || sent.length !== req.session.csrf.length) {
    return res.status(403).json({ error: 'csrf-token fehlt oder passt nicht' });
  }
  const ok = crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(req.session.csrf));
  if (!ok) return res.status(403).json({ error: 'csrf-token fehlt oder passt nicht' });
  next();
}
