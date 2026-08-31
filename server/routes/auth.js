// anmelden, abmelden, nachfragen wer man ist.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import {
  COOKIE, verifyPassword, createSession, destroySession, cookieOptions, requireCsrf,
} from '../auth.js';

export const auth = Router();

// deutlich strenger als der rest der api: zehn versuche pro viertelstunde
// und ip. erfolgreiche anmeldungen zaehlen nicht mit.
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'zu viele versuche. in 15 minuten nochmal.' },
});

const qUser = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?');

auth.post('/login', loginLimit, async (req, res) => {
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');

  const user = qUser.get(username);

  // auch ohne treffer wird geprueft, damit die antwortzeit nicht verraet,
  // ob es den benutzernamen ueberhaupt gibt
  const dummy = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=$AAAA';
  const ok = await verifyPassword(password, user ? user.password_hash : dummy);

  if (!user || !ok) {
    // absichtlich unspezifisch: kein hinweis darauf, was falsch war
    return res.status(401).json({ error: 'anmeldung fehlgeschlagen' });
  }

  const { token, csrf } = createSession(user.id);
  res.cookie(COOKIE, token, cookieOptions());
  res.json({ username: user.username, csrf });
});

auth.post('/logout', (req, res) => {
  destroySession(req.cookies?.[COOKIE]);
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

// die admin-oberflaeche fragt hierueber ab, ob sie ueberhaupt etwas anzeigen darf
auth.get('/me', (req, res) => {
  if (!req.session) return res.status(401).json({ error: 'nicht angemeldet' });
  res.json({ username: req.session.username, csrf: req.session.csrf });
});

// passwort aendern, ohne aufs terminal zu muessen
auth.post('/password', requireCsrf, async (req, res) => {
  if (!req.session) return res.status(401).json({ error: 'nicht angemeldet' });

  const current = String(req.body?.current ?? '');
  const next = String(req.body?.next ?? '');
  if (next.length < 12) return res.status(400).json({ error: 'mindestens 12 zeichen' });

  const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(req.session.user_id);
  if (!user || !(await verifyPassword(current, user.password_hash))) {
    return res.status(403).json({ error: 'das bisherige passwort stimmt nicht' });
  }

  const { hashPassword } = await import('../auth.js');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(await hashPassword(next), user.id);

  // alle anderen sessions beenden, die eigene behalten
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?')
    .run(user.id, req.session.token_hash);

  res.json({ ok: true });
});
