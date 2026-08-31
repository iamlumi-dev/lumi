// spielt eine sicherung zurueck.
//   npm run db:restore              → listet die vorhandenen sicherungen
//   npm run db:restore -- <datei>   → spielt diese zurueck
//
// bevor etwas ueberschrieben wird, sichert das script den JETZIGEN stand —
// auch ein versehentliches zurueckspielen soll nichts endgueltig kosten.

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../server/config.js';
import { backupDatabase, listBackups, BACKUP_DIR } from './backup.js';

const wanted = process.argv[2];
const all = listBackups();

if (!all.length) {
  console.log('keine sicherungen vorhanden.');
  process.exit(0);
}

if (!wanted) {
  console.log(`sicherungen in ${path.relative(process.cwd(), BACKUP_DIR)}:\n`);
  for (const b of all) {
    console.log(`  ${b.file}   ${String(b.kb).padStart(6)} kB   ${b.at.toLocaleString('de-DE')}`);
  }
  console.log('\nzurückspielen:  npm run db:restore -- <dateiname>');
  process.exit(0);
}

// nur dateien aus dem sicherungsordner, kein pfad von aussen
const chosen = all.find((b) => b.file === wanted || b.file === path.basename(wanted));
if (!chosen) {
  console.error(`✗ "${wanted}" ist keine der vorhandenen sicherungen.`);
  console.error('  ohne argument aufrufen, um die liste zu sehen.');
  process.exit(1);
}

// erst den jetzigen stand wegsichern …
console.log('sichere den aktuellen stand, bevor er überschrieben wird …');
await backupDatabase('vor-restore');

// … dann zurueckspielen. WAL und SHM muessen mit weg, sonst mischt sqlite
// die alte datei mit dem neuen journal.
for (const suffix of ['-wal', '-shm']) {
  fs.rmSync(config.databasePath + suffix, { force: true });
}
fs.copyFileSync(chosen.path, config.databasePath);

console.log(`✓ ${chosen.file} zurückgespielt nach ${path.relative(process.cwd(), config.databasePath)}`);
console.log('  den server neu starten, damit er die datei neu öffnet.');
