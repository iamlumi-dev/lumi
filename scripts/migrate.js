// legt das schema an (idempotent). aufruf: npm run db:migrate
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../server/db.js';
import { ROOT, config } from '../server/config.js';

// --- 1. spalten nachtragen --------------------------------------------------
// WICHTIG: jede spalte, die hier steht, muss AUCH in schema.sql stehen.
// dieser abschnitt greift nur bei einer datenbank, in der die tabelle schon
// existiert — eine frische bekommt ihre spalten aus schema.sql. wer das
// vergisst, baut eine datenbank, die nur nach einem update funktioniert.
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
  ['links', 'note',      "TEXT NOT NULL DEFAULT ''"],
  ['media', 'thumb',     'TEXT'],
  // zweiter faktor
  ['users', 'totp_secret',    'TEXT'],
  ['users', 'totp_pending',   'TEXT'],
  ['users', 'totp_last_step', 'INTEGER'],
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

// --- 4. zeilen, die ein feature zum funktionieren braucht -------------------
// neue seiten kommen NICHT ueber den seed: der laeuft auf einem laufenden
// server nie. sie werden hier angelegt, mit INSERT OR IGNORE — vorhandene
// zeilen bleiben also unangetastet, auch wenn der text schon geaendert wurde.
const REQUIRED_PAGES = [
  {
    slug: 'friends',
    title: 'friends',
    layout: 'links',
    tab_group: 'friends',
    body: 'people whose sites are worth your time.',
  },
  {
    slug: 'colophon',
    title: 'colophon',
    layout: 'prose',
    tab_group: 'colophon',
    body: [
      'this site is a dark green terminal with something growing behind it. five colours, two fonts, everything lowercase.',
      '## colours',
      'five custom properties and nothing else. no second colour family — not even for errors. where something needs to stand apart it does so through brightness, opacity or italics, never through hue.',
      '## fonts',
      'cal sans for headings, xanh mono for everything else. one weight each. the italic of xanh mono exists only as a hover state, never as emphasis.',
      '## the background',
      'a p5.js canvas behind everything, drawing a grid of dots displaced by 3d perlin noise. the field drifts about five thousandths of a noise step per frame, which is slow enough that you never catch it moving. there is a second sketch that grows roots in from the edges of the screen — type "theme" in the terminal to switch.',
      '## the quiet ui',
      'on anything with a real pointer the navigation sits at ten percent opacity with transparent labels, and only appears once you hover the content. the idea is that you read first and click second. it costs one media query and a bit of patience.',
      '## the terminal',
      'bottom left. folded up it is just the line saying who made this. it navigates and it plays, it cannot break anything.',
      '## how it is built',
      'plain html, css and javascript — no framework, no build step. behind it a small node server with an sqlite file, so that posts, texts and splashes can be edited without touching any code.',
    ].join('\n\n'),
  },
];

const insertPage = db.prepare(`
  INSERT OR IGNORE INTO pages (slug, title, body, layout, tab_group, position)
  VALUES (@slug, @title, @body, @layout, @tab_group, 0)
`);

let pagesAdded = 0;
for (const page of REQUIRED_PAGES) {
  if (insertPage.run(page).changes) {
    console.log(`  + seite "${page.slug}" angelegt`);
    pagesAdded++;
  }
}

// --- 5. einmalige umstellungen ----------------------------------------------
// position bei einzelseiten bedeutet ab jetzt: platz in der navigation,
// 0 = wird nicht angezeigt. bisher stand da ueberall 0, was jede seite auf
// einmal aus der navigation genommen haette. deshalb einmalig durchnummerieren
// — und nur einmal, sonst wuerde eine spaeter bewusst gesetzte 0 wieder
// ueberschrieben.
const once = db.prepare('SELECT 1 FROM meta WHERE key = ?');
const remember = db.prepare('INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)');

if (!once.get('nav_positions')) {
  // reihenfolge wie bisher in den html-dateien
  const ORDER = ['shoutouts', 'friends', 'colophon'];
  const update = db.prepare('UPDATE pages SET position = ? WHERE slug = ? AND position = 0');
  let n = 0;
  ORDER.forEach((slug, i) => { n += update.run(i + 1, slug).changes; });
  remember.run('nav_positions', 'done');
  if (n) console.log(`  ~ ${n} seite(n) in die navigation einsortiert`);
}

console.log(`✓ schema aktuell in ${config.databasePath}${added ? ` (${added} spalte(n) ergänzt)` : ''}${pagesAdded ? ` (${pagesAdded} seite(n) angelegt)` : ''}`);
