// lese-zugriff auf posts, medien und kategorien.
// schreib-operationen kommen mit dem admin-bereich dazu.
import { db } from '../db.js';

export const POST_SIZES = ['small', 'wide', 'tall', 'large', 'banner'];
export const MEDIA_KINDS = ['image', 'video', 'audio'];

const selectPosts = db.prepare(`
  SELECT id, slug, title, summary, body, size, pinned, published, published_at,
         cell_id, slot
  FROM posts
  WHERE published = 1
  ORDER BY pinned DESC, published_at DESC, id DESC
`);

const selectPostBySlug = db.prepare(`
  SELECT id, slug, title, summary, body, size, pinned, published, published_at,
         cell_id, slot
  FROM posts
  WHERE slug = ? AND published = 1
`);

const selectMediaForPost = db.prepare(`
  SELECT id, kind, src, poster, thumb, waveform, alt, caption, is_cover, position
  FROM media
  WHERE post_id = ?
  ORDER BY position ASC, id ASC
`);

const selectCategoriesForPost = db.prepare(`
  SELECT c.id, c.slug, c.name
  FROM categories c
  JOIN post_categories pc ON pc.category_id = c.id
  WHERE pc.post_id = ?
  ORDER BY c.position ASC, c.name ASC
`);

const selectCategories = db.prepare(`
  SELECT c.id, c.slug, c.name, c.description, c.position,
         COUNT(pc.post_id) AS count
  FROM categories c
  LEFT JOIN post_categories pc ON pc.category_id = c.id
  LEFT JOIN posts p ON p.id = pc.post_id AND p.published = 1
  GROUP BY c.id
  ORDER BY c.position ASC, c.name ASC
`);

// baut aus einer post-zeile das objekt, das die api ausliefert
function hydrate(row) {
  if (!row) return null;
  const media = selectMediaForPost.all(row.id).map((m) => ({
    id: m.id,
    kind: m.kind,
    src: m.src,
    poster: m.poster || null,
    // kleine fassung fuers raster; die detailseite nimmt src
    thumb: m.thumb || null,
    // vorberechnete huellkurve bei audio
    waveform: m.waveform || null,
    alt: m.alt,
    caption: m.caption,
    isCover: !!m.is_cover,
  }));

  // cover = explizit markiert, sonst das erste bild, sonst das erste medium ueberhaupt
  const cover =
    media.find((m) => m.isCover) ||
    media.find((m) => m.kind === 'image') ||
    media[0] ||
    null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    size: row.size,
    pinned: !!row.pinned,
    // anordnung: in welcher spalte der post steckt und an welcher stelle
    cellId: row.cell_id || null,
    slot: row.slot || 0,
    publishedAt: row.published_at,
    categories: selectCategoriesForPost.all(row.id),
    media,
    cover,
    // welche medienarten der post enthaelt — das frontend zeigt daraus kleine marker
    kinds: [...new Set(media.map((m) => m.kind))],
    hasText: row.body.trim().length > 0 || row.summary.trim().length > 0,
  };
}

export function listPosts() {
  return selectPosts.all().map(hydrate);
}

export function getPost(slug) {
  return hydrate(selectPostBySlug.get(slug));
}

export function listCategories() {
  return selectCategories.all().map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    count: c.count,
  }));
}

// vorheriger / naechster post in derselben sortierung wie die uebersicht
export function neighbours(slug) {
  const all = selectPosts.all();
  const i = all.findIndex((p) => p.slug === slug);
  if (i === -1) return { prev: null, next: null };
  const pick = (row) => (row ? { slug: row.slug, title: row.title } : null);
  return { prev: pick(all[i - 1]), next: pick(all[i + 1]) };
}

/* ---- anordnung fuer das frontend -----------------------------------------
   geliefert werden nur ids. das frontend filtert die post-liste ohnehin
   selbst und laesst dann die fehlenden aus den spalten fallen; weil die
   gewichte relativ sind, bleibt jede zeile dabei automatisch voll.        */

export function publicLayout() {
  const posts = listPosts();
  const byId = new Map(posts.map((p) => [p.id, p]));

  const rows = db.prepare('SELECT id, units FROM grid_rows ORDER BY position ASC, id ASC').all();
  const cells = db.prepare(
    'SELECT id, row_id, weight FROM grid_cells ORDER BY position ASC, id ASC'
  ).all();

  const inCell = new Map(cells.map((c) => [c.id, []]));
  const placed = new Set();
  for (const post of posts) {
    if (post.cellId && inCell.has(post.cellId)) {
      inCell.get(post.cellId).push(post);
      placed.add(post.id);
    }
  }
  for (const list of inCell.values()) list.sort((a, b) => a.slot - b.slot || a.id - b.id);

  const cellsOfRow = new Map(rows.map((r) => [r.id, []]));
  for (const cell of cells) {
    const list = inCell.get(cell.id);
    if (list.length) {
      cellsOfRow.get(cell.row_id)?.push({ weight: cell.weight, posts: list.map((p) => p.id) });
    }
  }

  return {
    rows: rows
      .map((r) => ({ units: r.units, cells: cellsOfRow.get(r.id) || [] }))
      .filter((r) => r.cells.length),
    // noch nicht eingeordnet — das frontend haengt sie selbsttaetig an
    loose: posts.filter((p) => !placed.has(p.id)).map((p) => p.id),
  };
}
