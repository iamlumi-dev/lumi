// empfehlungen — sachen von anderen leuten, die lumi gut findet.
import { db } from '../db.js';

export const SHOUTOUT_KINDS = ['song', 'album', 'artist', 'video', 'other'];

const qPublic = db.prepare(`
  SELECT id, creator, title, kind, url, note, cover, youtube, shouted_at
  FROM shoutouts WHERE published = 1
  ORDER BY shouted_at DESC, id DESC
`);

function shape(row) {
  return {
    id: row.id,
    creator: row.creator,
    title: row.title,
    kind: row.kind,
    url: row.url || null,
    note: row.note,
    // eigenes bild schlaegt das youtube-vorschaubild
    cover: row.cover || (row.youtube ? `https://i.ytimg.com/vi/${row.youtube}/hqdefault.jpg` : null),
    youtube: row.youtube || null,
    date: row.shouted_at,
  };
}

export function listShoutouts() {
  return qPublic.all().map(shape);
}

// nur die tatsaechlich vorkommenden arten — das frontend baut daraus
// seine filterleiste und laesst sie weg, wenn es nur eine gibt
export function shoutoutKindsInUse() {
  return db.prepare(`
    SELECT kind, COUNT(*) AS count FROM shoutouts WHERE published = 1
    GROUP BY kind ORDER BY count DESC, kind ASC
  `).all();
}
