// legt das schema an (idempotent). aufruf: npm run db:migrate
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../server/db.js';
import { ROOT, config } from '../server/config.js';

// --- 1. spalten nachtragen --------------------------------------------------
// "CREATE TABLE IF NOT EXISTS" laesst eine bereits vorhandene tabelle in ruhe.
// spalten, die spaeter dazugekommen sind, muessen deshalb einzeln nachgezogen
// werden. das passiert VOR dem einspielen von schema.sql, weil dort indizes
// stehen, die sich auf genau diese spalten beziehen.
//
// bei einer frischen datenbank existiert die tabelle noch gar nicht — dann
// wird hier nichts getan und schema.sql legt sie gleich vollstaendig an.
const ADDED_COLUMNS = [
  ['pages', 'layout',    "TEXT NOT NULL DEFAULT 'prose'"],
  ['pages', 'tab_group', "TEXT NOT NULL DEFAULT ''"],
  ['pages', 'position',  'INTEGER NOT NULL DEFAULT 0'],
];

const tableExists = (name) =>
  !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);

let added = 0;
for (const [table, column, definition] of ADDED_COLUMNS) {
  if (!tableExists(table)) continue;
  const has = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (has) continue;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`  + spalte ${table}.${column} nachgetragen`);
  added++;
}

// --- 2. tabellen und indizes ------------------------------------------------
const sql = fs.readFileSync(path.join(ROOT, 'server', 'schema.sql'), 'utf8');
db.exec(sql);

console.log(`✓ schema aktuell in ${config.databasePath}${added ? ` (${added} spalte(n) ergänzt)` : ''}`);
