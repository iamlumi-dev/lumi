// anmelden, abmelden, zweiter faktor, passwort aendern.
import { Router } from 'express';
import QRCode from 'qrcode';

import { db } from '../db.js';
import { config } from '../config.js';
import {
  COOKIE, hashPassword, verifyPassword, createSession, destroySession,
  cookieOptions, requireCsrf,
} from '../auth.js';
import * as attempts from '../lib/attempts.js';
import {
  newSecret, verifyCode, otpauthUri, newRecoveryCodes, hashRecoveryCode,
} from '../lib/totp.js';

export const auth = Router();

const qUser = db.prepare(`
  SELECT id, username, password_hash, totp_secret, totp_pending, totp_last_step
  FROM users WHERE username = ?
`);
const qUserById = db.prepare(`
  SELECT id, username, password_hash, totp_secret, totp_pending, totp_last_step
  FROM users WHERE id = ?
`);

/* =======================================================================
   anmelden
   ======================================================================= */

auth.post('/login', async (req, res) => {
  const ip = req.ip || '';
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  const code = String(req.body?.code ?? '').trim();

  // die begrenzung rechnet aus der datenbank und uebersteht damit einen
  // neustart. gezaehlt werden nur fehlversuche.
  const gate = attempts.check(ip);
  if (!gate.allowed) {
    attempts.record({ ip, username, ok: false, reason: 'rate_limited' });
    res.set('Retry-After', String(gate.retryAfter));
    return res.status(429).json({
      error: gate.window === 'day'
        ? 'zu viele versuche heute. morgen nochmal.'
        : 'zu viele versuche. in 15 minuten nochmal.',
    });
  }

  const user = qUser.get(username);

  // auch ohne treffer wird geprueft, damit die antwortzeit nicht verraet,
  // ob es den benutzernamen ueberhaupt gibt
  const dummy = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=$AAAA';
  const passwordOk = await verifyPassword(password, user ? user.password_hash : dummy);

  if (!user || !passwordOk) {
    attempts.record({ ip, username, ok: false, reason: 'bad_credentials' });
    // absichtlich unspezifisch: kein hinweis darauf, was falsch war
    return res.status(401).json({ error: 'anmeldung fehlgeschlagen' });
  }

  // --- zweiter faktor, falls eingerichtet ---
  if (user.totp_secret) {
    if (!code) {
      // noch keine session — nur die auskunft, dass ein code fehlt.
      // das gilt nicht als fehlversuch, das passwort war ja richtig.
      return res.status(200).json({ totpRequired: true });
    }

    const step = verifyCode(user.totp_secret, code, { lastStep: user.totp_last_step });
    if (step !== null) {
      // denselben code nicht zweimal zulassen
      db.prepare('UPDATE users SET totp_last_step = ? WHERE id = ?').run(step, user.id);
    } else if (!useRecoveryCode(user.id, code)) {
      attempts.record({ ip, username, ok: false, reason: 'bad_totp' });
      return res.status(401).json({ error: 'code stimmt nicht', totpRequired: true });
    }
  }

  const { token, csrf } = createSession(user.id);
  attempts.record({ ip, username, ok: true });
  res.cookie(COOKIE, token, cookieOptions());
  res.json({ username: user.username, csrf });
});

// ein wiederherstellungs-code gilt genau einmal
function useRecoveryCode(userId, input) {
  const hash = hashRecoveryCode(input);
  const row = db.prepare(
    'SELECT id FROM recovery_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL'
  ).get(userId, hash);
  if (!row) return false;
  db.prepare("UPDATE recovery_codes SET used_at = datetime('now') WHERE id = ?").run(row.id);
  console.warn(`lumiswork recovery code used user_id=${userId}`);
  return true;
}

auth.post('/logout', (req, res) => {
  destroySession(req.cookies?.[COOKIE]);
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

// die admin-oberflaeche fragt hierueber ab, ob sie ueberhaupt etwas anzeigen darf
auth.get('/me', (req, res) => {
  if (!req.session) return res.status(401).json({ error: 'nicht angemeldet' });
  const user = qUserById.get(req.session.user_id);
  const unused = db.prepare(
    'SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ? AND used_at IS NULL'
  ).get(user.id).n;

  res.json({
    username: req.session.username,
    csrf: req.session.csrf,
    totp: !!user.totp_secret,
    recoveryLeft: unused,
  });
});

/* =======================================================================
   passwort aendern
   ======================================================================= */

auth.post('/password', requireCsrf, async (req, res) => {
  if (!req.session) return res.status(401).json({ error: 'nicht angemeldet' });

  const current = String(req.body?.current ?? '');
  const next = String(req.body?.next ?? '');
  if (next.length < 12) return res.status(400).json({ error: 'mindestens 12 zeichen' });

  const user = qUserById.get(req.session.user_id);
  if (!user || !(await verifyPassword(current, user.password_hash))) {
    return res.status(403).json({ error: 'das bisherige passwort stimmt nicht' });
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(await hashPassword(next), user.id);

  // alle anderen sessions beenden, die eigene behalten
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?')
    .run(user.id, req.session.token_hash);

  res.json({ ok: true });
});

/* =======================================================================
   zweiter faktor einrichten
   ======================================================================= */

// schritt 1: geheimnis erzeugen und als "noch nicht bestaetigt" ablegen.
// scharf wird es erst, wenn ein code daraus stimmt — sonst koennte sich
// jemand aussperren, dessen app das geheimnis nie bekommen hat.
auth.post('/totp/setup', requireCsrf, (req, res) => {
  if (!req.session) return res.status(401).json({ error: 'nicht angemeldet' });

  const user = qUserById.get(req.session.user_id);
  if (user.totp_secret) return res.status(409).json({ error: 'ist schon eingerichtet' });

  const secret = newSecret();
  db.prepare('UPDATE users SET totp_pending = ? WHERE id = ?').run(secret, user.id);

  const uri = otpauthUri(secret, { account: user.username, issuer: config.site.name });
  QRCode.toDataURL(uri, { margin: 1, width: 240, color: { dark: '#0B1306', light: '#cce3c3' } })
    .then((qr) => res.json({ secret, uri, qr }))
    .catch(() => res.json({ secret, uri, qr: null }));
});

// schritt 2: code aus der app pruefen, dann scharfstellen
auth.post('/totp/enable', requireCsrf, (req, res) => {
  if (!req.session) return res.status(401).json({ error: 'nicht angemeldet' });

  const user = qUserById.get(req.session.user_id);
  if (!user.totp_pending) return res.status(409).json({ error: 'erst einrichten' });

  const step = verifyCode(user.totp_pending, String(req.body?.code ?? ''));
  if (step === null) return res.status(400).json({ error: 'code stimmt nicht' });

  const codes = newRecoveryCodes();
  db.transaction(() => {
    db.prepare(`
      UPDATE users SET totp_secret = totp_pending, totp_pending = NULL, totp_last_step = ?
      WHERE id = ?
    `).run(step, user.id);

    db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').run(user.id);
    const insert = db.prepare('INSERT INTO recovery_codes (user_id, code_hash) VALUES (?, ?)');
    for (const code of codes) insert.run(user.id, hashRecoveryCode(code));
  })();

  console.warn(`lumiswork totp enabled user="${user.username}"`);
  // die codes werden genau hier einmal gezeigt und danach nie wieder
  res.json({ ok: true, recoveryCodes: codes });
});

// abschalten braucht passwort UND einen gueltigen code — sonst genuegte
// eine uebernommene session, um den zweiten faktor loszuwerden
auth.post('/totp/disable', requireCsrf, async (req, res) => {
  if (!req.session) return res.status(401).json({ error: 'nicht angemeldet' });

  const user = qUserById.get(req.session.user_id);
  if (!user.totp_secret) return res.status(409).json({ error: 'ist nicht eingerichtet' });

  if (!(await verifyPassword(String(req.body?.password ?? ''), user.password_hash))) {
    return res.status(403).json({ error: 'passwort stimmt nicht' });
  }

  const code = String(req.body?.code ?? '');
  const ok = verifyCode(user.totp_secret, code, { lastStep: user.totp_last_step }) !== null
    || useRecoveryCode(user.id, code);
  if (!ok) return res.status(403).json({ error: 'code stimmt nicht' });

  db.transaction(() => {
    db.prepare(`
      UPDATE users SET totp_secret = NULL, totp_pending = NULL, totp_last_step = NULL
      WHERE id = ?
    `).run(user.id);
    db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').run(user.id);
  })();

  console.warn(`lumiswork totp DISABLED user="${user.username}"`);
  res.json({ ok: true });
});

/* =======================================================================
   anmeldeversuche ansehen
   ======================================================================= */

auth.get('/attempts', (req, res) => {
  if (!req.session) return res.status(401).json({ error: 'nicht angemeldet' });
  res.json({
    summary: attempts.summary(),
    recent: attempts.recent(25),
    limits: attempts.LIMITS,
  });
});
