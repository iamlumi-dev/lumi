// =========================================================================
// anmeldeversuche: protokoll und begrenzung
// =========================================================================
// die begrenzung rechnet direkt aus der tabelle. das hat zwei vorteile
// gegenueber einem zaehler im arbeitsspeicher: sie uebersteht einen neustart
// des servers, und das protokoll fuer fail2ban fällt dabei sowieso an.

import { db } from '../db.js';

// zwei fenster: ein kurzes gegen schnelle versuchsreihen, ein langes gegen
// jemanden, der ueber tage hinweg langsam durchprobiert
export const LIMITS = {
  short: { minutes: 15, max: 10 },
  day: { minutes: 60 * 24, max: 30 },
};

const KEEP_DAYS = 30;

const insert = db.prepare(
  'INSERT INTO login_attempts (ip, username, ok, reason) VALUES (?, ?, ?, ?)'
);

// abgewiesene versuche zaehlen NICHT mit. sonst verlaengert jeder weitere
// klick die eigene sperre, und ein kurzer schwall wuerde das tagesbudget
// sofort verbrauchen — womit sich lumi selbst fuer einen tag aussperren
// koennte. festgehalten werden sie trotzdem, nur eben nicht gezaehlt.
const countFailures = db.prepare(`
  SELECT COUNT(*) AS n FROM login_attempts
  WHERE ip = ? AND ok = 0 AND reason != 'rate_limited' AND at > datetime('now', ?)
`);

const prune = db.prepare("DELETE FROM login_attempts WHERE at < datetime('now', ?)");

/**
 * haelt einen versuch fest und schreibt ihn ins log.
 * das logformat ist absichtlich eine einzelne, gut greifbare zeile —
 * fail2ban liest sie mit einem einfachen ausdruck (siehe SETUP.md).
 */
export function record({ ip, username, ok, reason = '' }) {
  insert.run(ip || '', username || '', ok ? 1 : 0, reason);

  if (ok) {
    console.log(`lumiswork login ok ip=${ip} user="${username}"`);
  } else {
    console.warn(`lumiswork login FAILED ip=${ip} user="${username}" reason=${reason || 'unknown'}`);
  }

  // gelegentlich aufraeumen, nicht bei jedem versuch
  if (Math.random() < 0.02) prune.run(`-${KEEP_DAYS} days`);
}

/**
 * darf diese adresse es noch versuchen?
 * @returns {{allowed: boolean, retryAfter?: number, window?: string}}
 */
export function check(ip) {
  for (const [name, limit] of Object.entries(LIMITS)) {
    const { n } = countFailures.get(ip || '', `-${limit.minutes} minutes`);
    if (n >= limit.max) {
      return { allowed: false, window: name, retryAfter: limit.minutes * 60 };
    }
  }
  return { allowed: true };
}

/** die letzten versuche, fuer die anzeige im editor */
export function recent(limit = 25) {
  return db.prepare(`
    SELECT at, ip, username, ok, reason FROM login_attempts
    ORDER BY id DESC LIMIT ?
  `).all(limit).map((r) => ({ ...r, ok: !!r.ok }));
}

/** zusammenfassung fuer den editor: was war in den letzten 24 stunden */
export function summary() {
  const row = db.prepare(`
    SELECT
      SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) AS succeeded,
      COUNT(DISTINCT CASE WHEN ok = 0 THEN ip END) AS addresses
    FROM login_attempts WHERE at > datetime('now', '-1 day')
  `).get();
  return {
    failed: row.failed || 0,
    succeeded: row.succeeded || 0,
    addresses: row.addresses || 0,
  };
}
