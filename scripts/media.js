// erzeugt fehlende abgeleitete medien: standbilder fuer videos und kleine
// fassungen fuer grosse bilder.
//   npm run media:prepare
// laesst sich gefahrlos wiederholen: vorhandene standbilder werden nicht
// angefasst, und geschrieben wird nur die poster-spalte.
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../server/db.js';
import { config } from '../server/config.js';
import { makePoster, makeThumb, ffmpegAvailable } from '../server/lib/poster.js';
import { backupDatabase } from './backup.js';

if (!(await ffmpegAvailable())) {
  console.error('✗ ffmpeg nicht gefunden. ohne ffmpeg lassen sich keine standbilder erzeugen.');
  process.exit(1);
}

const rows = db.prepare(`
  SELECT m.id, m.kind, m.src, m.poster, m.thumb, p.title
  FROM media m JOIN posts p ON p.id = m.post_id
  WHERE m.kind IN ('video', 'image')
  ORDER BY m.id
`).all();

const exists = (rel) =>
  !!rel && fs.existsSync(path.resolve(config.uploadsDir, rel.replace(/^\/uploads\//, '')));

// video braucht ein standbild, bild eine kleine fassung
const todo = rows.filter((r) =>
  r.kind === 'video' ? !exists(r.poster) : !exists(r.thumb));

console.log(`${rows.length} medien, davon ${todo.length} ohne abgeleitete fassung.`);
if (!todo.length) process.exit(0);

// es werden nur zwei spalten geschrieben, aber die regel gilt trotzdem
await backupDatabase('vor-media-prepare');

const setPoster = db.prepare('UPDATE media SET poster = ? WHERE id = ?');
const setThumb = db.prepare('UPDATE media SET thumb = ? WHERE id = ?');
const kb = (rel) =>
  Math.round(fs.statSync(path.resolve(config.uploadsDir, rel.replace(/^\/uploads\//, ''))).size / 1024);

let made = 0;

for (const row of todo) {
  const label = `${row.kind === 'video' ? 'standbild' : 'kleine fassung'} für ${row.title}`;
  process.stdout.write(`  ${label} … `);

  const out = row.kind === 'video' ? await makePoster(row.src) : await makeThumb(row.src);

  if (out) {
    (row.kind === 'video' ? setPoster : setThumb).run(out, row.id);
    console.log(`✓ ${kb(row.src)} kB → ${kb(out)} kB`);
    made++;
  } else {
    console.log(row.kind === 'image' ? '— schon klein genug' : '✗ ging nicht');
  }
}

console.log(`\n✓ ${made} fassung(en) erzeugt`);
