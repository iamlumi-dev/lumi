// =========================================================================
// sicherung der datenbank
// =========================================================================
// wird von jedem script aufgerufen, das etwas loeschen oder ueberschreiben
// koennte. grundregel im projekt: es wird nie etwas weggeworfen, ohne dass
// vorher eine kopie liegt.
//
// direkt aufrufbar:  npm run db:backup
// zurueckspielen:    npm run db:restore -- <datei>

import fs from 'node:fs';
import path from 'node:path';
import { db } from '../server/db.js';
import { config } from '../server/config.js';

export const BACKUP_DIR = path.join(path.dirname(config.databasePath), 'backups');

// wie viele sicherungen aufgehoben werden, bevor die aeltesten wegfallen
const KEEP = 30;

/**
 * legt eine konsistente kopie der datenbank an.
 * benutzt die online-backup-schnittstelle von sqlite, nicht cp — bei
 * eingeschaltetem WAL waere ein einfaches kopieren der datei unvollstaendig.
 */
export async function backupDatabase(reason = 'manual') {
  if (!fs.existsSync(config.databasePath)) return null;

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeReason = String(reason).replace(/[^a-z0-9-]/gi, '-').slice(0, 40);
  const target = path.join(BACKUP_DIR, `${stamp}-${safeReason}.db`);

  await db.backup(target);
  prune();

  const kb = Math.round(fs.statSync(target).size / 1024);
  console.log(`↳ sicherung: ${path.relative(process.cwd(), target)} (${kb} kB)`);
  return target;
}

// nur die neuesten KEEP behalten
function prune() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.db'))
    .sort()
    .reverse();
  for (const old of files.slice(KEEP)) {
    fs.rmSync(path.join(BACKUP_DIR, old), { force: true });
  }
}

export function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.db'))
    .sort()
    .reverse()
    .map((f) => {
      const full = path.join(BACKUP_DIR, f);
      const s = fs.statSync(full);
      return { file: f, path: full, kb: Math.round(s.size / 1024), at: s.mtime };
    });
}

// direkter aufruf: npm run db:backup
if (import.meta.url === `file://${process.argv[1]}`) {
  await backupDatabase('manual');
  const all = listBackups();
  console.log(`✓ ${all.length} sicherung(en) in ${path.relative(process.cwd(), BACKUP_DIR)}`);
}
