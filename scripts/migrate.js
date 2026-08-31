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

// --- 3. geaenderte CHECK-bedingungen ----------------------------------------
// sqlite kann eine CHECK-bedingung nicht per ALTER aendern. der offizielle weg
// ist: neue tabelle anlegen, daten kopieren, alte loeschen, umbenennen.
// laeuft nur, wenn die bedingung 'youtube' noch nicht kennt.
const mediaSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='media'").get();
if (mediaSql && !mediaSql.sql.includes("'youtube'")) {
  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    db.exec(`
      CREATE TABLE media__new (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id  INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        kind     TEXT    NOT NULL CHECK (kind IN ('image','video','audio','youtube')),
        src      TEXT    NOT NULL,
        poster   TEXT,
        alt      TEXT    NOT NULL DEFAULT '',
        caption  TEXT    NOT NULL DEFAULT '',
        is_cover INTEGER NOT NULL DEFAULT 0 CHECK (is_cover IN (0,1)),
        position INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO media__new (id, post_id, kind, src, poster, alt, caption, is_cover, position)
        SELECT id, post_id, kind, src, poster, alt, caption, is_cover, position FROM media;
      DROP TABLE media;
      ALTER TABLE media__new RENAME TO media;
      CREATE INDEX IF NOT EXISTS idx_media_post ON media (post_id, position);
    `);
  })();
  db.pragma('foreign_keys = ON');
  // nach so einem umbau lohnt der integritaetscheck
  const bad = db.pragma('foreign_key_check');
  if (bad.length) throw new Error('fremdschluessel nach dem umbau kaputt: ' + JSON.stringify(bad));
  console.log('  ~ tabelle media neu gebaut (kind kennt jetzt youtube)');
}

console.log(`✓ schema aktuell in ${config.databasePath}${added ? ` (${added} spalte(n) ergänzt)` : ''}`);
