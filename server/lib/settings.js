// =========================================================================
// globale einstellungen
// =========================================================================
// liegen als json in der meta-tabelle. gedacht fuer dinge, die fuer die
// ganze seite gelten und nicht an einem einzelnen inhalt haengen — bisher
// das aussehen des partikelfelds.
//
// jeder wert hat einen typ und grenzen. was nicht dazu passt, wird auf den
// standard zurueckgesetzt, statt eine kaputte einstellung auszuliefern.

import { db } from '../db.js';

export const VIZ_FIELDS = {
  count:     { type: 'int',  min: 40,  max: 800, default: 260,
               label: 'particles', hint: 'how many dots' },
  smoothing: { type: 'num',  min: 0,   max: 0.95, step: 0.05, default: 0.45,
               label: 'smoothing', hint: 'higher is calmer, lower reacts harder' },
  reach:     { type: 'num',  min: 0.2, max: 3,   step: 0.1, default: 1,
               label: 'reach', hint: 'how far the music pushes them out' },
  spring:    { type: 'num',  min: 0.2, max: 3,   step: 0.1, default: 1,
               label: 'return', hint: 'how quickly they settle back' },
  pulse:     { type: 'num',  min: 0,   max: 3,   step: 0.1, default: 1,
               label: 'bass kick', hint: 'the jolt on a beat — brief' },
  drive:     { type: 'num',  min: 0,   max: 3,   step: 0.1, default: 1,
               label: 'bass hold', hint: 'how far bass holds the field open while it plays' },
  pump:      { type: 'bool', default: true,
               label: 'dots swell', hint: 'dots grow and shrink with the sound' },
  tint:      { type: 'bool', default: true,
               label: 'colour by frequency', hint: 'deep tones dark and large, highs pale and small' },
  connect:   { type: 'bool', default: false,
               label: 'connect nearby dots', hint: 'turns the swarm into a web' },
  trails:    { type: 'bool', default: false,
               label: 'trails', hint: 'dots leave a fading trace' },
};

export const VIZ_DEFAULTS = Object.fromEntries(
  Object.entries(VIZ_FIELDS).map(([k, f]) => [k, f.default])
);

const KEY = 'viz';

const qGet = db.prepare('SELECT value FROM meta WHERE key = ?');
const qSet = db.prepare(`
  INSERT INTO meta (key, value, at) VALUES (?, ?, datetime('now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, at = datetime('now')
`);

/** einen einzelnen wert auf seinen typ und seine grenzen bringen */
function clean(name, value) {
  const field = VIZ_FIELDS[name];
  if (!field) return undefined;

  if (field.type === 'bool') {
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  const n = Number(value);
  if (!Number.isFinite(n)) return field.default;
  const clamped = Math.min(field.max, Math.max(field.min, n));
  return field.type === 'int' ? Math.round(clamped) : Math.round(clamped * 100) / 100;
}

export function getViz() {
  let stored = {};
  try {
    stored = JSON.parse(qGet.get(KEY)?.value || '{}');
  } catch {
    stored = {};
  }

  const out = { ...VIZ_DEFAULTS };
  for (const name of Object.keys(VIZ_FIELDS)) {
    if (stored[name] !== undefined) out[name] = clean(name, stored[name]);
  }
  return out;
}

export function setViz(patch) {
  const next = { ...getViz() };
  for (const [name, value] of Object.entries(patch || {})) {
    if (VIZ_FIELDS[name]) next[name] = clean(name, value);
  }
  qSet.run(KEY, JSON.stringify(next));
  return next;
}
