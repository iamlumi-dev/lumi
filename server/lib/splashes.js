// die zeile unter dem titel auf der startseite.
import { db } from '../db.js';

const qRandom = db.prepare(
  'SELECT id, text, wrap FROM splashes WHERE active = 1 ORDER BY RANDOM() LIMIT 1'
);
const qActive = db.prepare('SELECT id, text, wrap FROM splashes WHERE active = 1 ORDER BY id ASC');

export function randomSplash() {
  const row = qRandom.get();
  return row ? { id: row.id, text: row.text, wrap: row.wrap !== 0 } : null;
}

// alle aktiven auf einmal: die startseite zieht daraus selbst und kann bei
// jedem klick eine neue zeigen, ohne dafuer nachzuladen.
export function activeSplashes() {
  return qActive.all().map((s) => ({ id: s.id, text: s.text, wrap: s.wrap !== 0 }));
}
