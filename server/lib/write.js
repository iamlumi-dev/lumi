// =========================================================================
// schreibender datenzugriff — wird ausschliesslich vom admin-bereich benutzt
// =========================================================================
// alle funktionen erwarten bereits gepruefte werte (siehe validate.js) und
// arbeiten mit prepared statements.

import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db.js';
import { config } from '../config.js';
import { uniqueSlug } from './slug.js';

/* ---- posts --------------------------------------------------------------- */

const qAllPosts = db.prepare(`
  SELECT p.id, p.slug, p.title, p.summary, p.body, p.size, p.pinned, p.published,
         p.published_at, p.updated_at,
         (SELECT COUNT(*) FROM media m WHERE m.post_id = p.id) AS media_count
  FROM posts p
  ORDER BY p.pinned DESC, p.published_at DESC, p.id DESC
`);

const qPostById = db.prepare('SELECT * FROM posts WHERE id = ?');

export function listAllPosts() {
  return qAllPosts.all().map((p) => ({
    id: p.id, slug: p.slug, title: p.title, summary: p.summary, body: p.body,
    size: p.size, pinned: !!p.pinned, published: !!p.published,
    publishedAt: p.published_at, updatedAt: p.updated_at,
    mediaCount: p.media_count,
    categories: qCategoriesOfPost.all(p.id).map((c) => c.id),
  }));
}

const qCategoriesOfPost = db.prepare(
  'SELECT category_id AS id FROM post_categories WHERE post_id = ?'
);

export function getPostAdmin(id) {
  const p = qPostById.get(id);
  if (!p) return null;
  return {
    id: p.id, slug: p.slug, title: p.title, summary: p.summary, body: p.body,
    size: p.size, pinned: !!p.pinned, published: !!p.published,
    publishedAt: p.published_at, updatedAt: p.updated_at,
    categories: qCategoriesOfPost.all(p.id).map((c) => c.id),
    media: listMedia(p.id),
  };
}

const qInsertPost = db.prepare(`
  INSERT INTO posts (slug, title, summary, body, size, pinned, published, published_at)
  VALUES (@slug, @title, @summary, @body, @size, @pinned, @published, @published_at)
`);

export function createPost(fields) {
  const slug = fields.slug ? uniqueSlug(db, 'posts', fields.slug) : uniqueSlug(db, 'posts', fields.title);
  const id = qInsertPost.run({ ...fields, slug, size: fields.size ?? 'small' }).lastInsertRowid;
  setPostCategories(id, fields.categories || []);
  return getPostAdmin(id);
}

export function updatePost(id, fields) {
  const current = qPostById.get(id);
  if (!current) return null;

  // slug nur neu berechnen, wenn er sich wirklich aendert — sonst wuerde
  // uniqueSlug den bestehenden als kollision werten und -2 anhaengen
  let slug = current.slug;
  if (fields.slug !== undefined && fields.slug !== current.slug) {
    slug = uniqueSlug(db, 'posts', fields.slug);
  }

  db.prepare(`
    UPDATE posts SET slug = @slug, title = @title, summary = @summary, body = @body,
                     size = @size, pinned = @pinned, published = @published,
                     published_at = @published_at, updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...fields, slug, id, size: fields.size ?? current.size });

  if (fields.categories) setPostCategories(id, fields.categories);
  return getPostAdmin(id);
}

export function deletePost(id) {
  // zugehoerige dateien mit entfernen, sonst bleiben sie fuer immer liegen
  const files = db.prepare("SELECT src, poster, thumb, waveform FROM media WHERE post_id = ?").all(id);
  const gone = db.prepare('DELETE FROM posts WHERE id = ?').run(id).changes;
  if (gone) {
    files.forEach((m) => {
      removeUpload(m.src); removeUpload(m.poster);
      removeUpload(m.thumb); removeUpload(m.waveform);
    });
  }
  return gone > 0;
}

const qClearCats = db.prepare('DELETE FROM post_categories WHERE post_id = ?');
const qLinkCat = db.prepare(
  'INSERT OR IGNORE INTO post_categories (post_id, category_id) VALUES (?, ?)'
);

export const setPostCategories = db.transaction((postId, categoryIds) => {
  qClearCats.run(postId);
  categoryIds.forEach((cid) => qLinkCat.run(postId, cid));
});

/* ---- medien -------------------------------------------------------------- */

const qMedia = db.prepare(`
  SELECT id, post_id, kind, src, poster, thumb, waveform, alt, caption, is_cover, position
  FROM media WHERE post_id = ? ORDER BY position ASC, id ASC
`);

export function listMedia(postId) {
  return qMedia.all(postId).map((m) => ({
    id: m.id, kind: m.kind, src: m.src, poster: m.poster, thumb: m.thumb,
    waveform: m.waveform,
    alt: m.alt, caption: m.caption, isCover: !!m.is_cover, position: m.position,
  }));
}

export function addMedia(postId, fields) {
  const next = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM media WHERE post_id = ?')
    .get(postId).n;
  const id = db.prepare(`
    INSERT INTO media (post_id, kind, src, poster, thumb, waveform, alt, caption, is_cover, position)
    VALUES (@post_id, @kind, @src, @poster, @thumb, @waveform, @alt, @caption, @is_cover, @position)
  `).run({ post_id: postId, position: next, thumb: null, waveform: null, ...fields }).lastInsertRowid;
  if (fields.is_cover) setCover(postId, id);
  return id;
}

export function updateMedia(id, fields) {
  const row = db.prepare('SELECT post_id FROM media WHERE id = ?').get(id);
  if (!row) return false;
  db.prepare('UPDATE media SET alt = @alt, caption = @caption WHERE id = @id')
    .run({ ...fields, id });
  if (fields.is_cover) setCover(row.post_id, id);
  return true;
}

// genau ein cover pro post
export const setCover = db.transaction((postId, mediaId) => {
  db.prepare('UPDATE media SET is_cover = 0 WHERE post_id = ?').run(postId);
  db.prepare('UPDATE media SET is_cover = 1 WHERE id = ? AND post_id = ?').run(mediaId, postId);
});

export function deleteMedia(id) {
  const row = db.prepare('SELECT src, poster, thumb, waveform FROM media WHERE id = ?').get(id);
  if (!row) return false;
  db.prepare('DELETE FROM media WHERE id = ?').run(id);
  // original und alles daraus abgeleitete gehoert weg
  removeUpload(row.src);
  removeUpload(row.poster);
  removeUpload(row.thumb);
  removeUpload(row.waveform);
  return true;
}

export const reorderMedia = db.transaction((postId, ids) => {
  const stmt = db.prepare('UPDATE media SET position = ? WHERE id = ? AND post_id = ?');
  ids.forEach((id, i) => stmt.run(i, id, postId));
});

// loescht eine datei aus /uploads — aber nur dort, und nie den seed-ordner
function removeUpload(src) {
  if (!src || !src.startsWith('/uploads/')) return;
  const rel = src.replace(/^\/uploads\//, '');
  if (rel.startsWith('seed/')) return;

  const target = path.resolve(config.uploadsDir, rel);
  // pfad muss innerhalb des upload-ordners liegen (schutz gegen ../)
  if (!target.startsWith(config.uploadsDir + path.sep)) return;

  // nur loeschen, wenn die datei nirgends mehr gebraucht wird — weder als
  // medium eines posts noch als titelbild eines shoutouts
  const usedByMedia = db.prepare(
    'SELECT 1 FROM media WHERE src = ? OR poster = ? OR thumb = ? OR waveform = ? LIMIT 1'
  ).get(src, src, src, src);
  const usedByShoutout = db.prepare('SELECT 1 FROM shoutouts WHERE cover = ? LIMIT 1').get(src);
  if (usedByMedia || usedByShoutout) return;

  fs.promises.unlink(target).catch(() => {});
}

/* ---- kategorien ---------------------------------------------------------- */

export function createCategory(fields) {
  const slug = uniqueSlug(db, 'categories', fields.slug || fields.name);
  const next = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM categories').get().n;
  const id = db.prepare(
    'INSERT INTO categories (slug, name, description, position) VALUES (?, ?, ?, ?)'
  ).run(slug, fields.name, fields.description, next).lastInsertRowid;
  return id;
}

export function updateCategory(id, fields) {
  const current = db.prepare('SELECT slug FROM categories WHERE id = ?').get(id);
  if (!current) return false;
  let slug = current.slug;
  if (fields.slug !== undefined && fields.slug !== current.slug) {
    slug = uniqueSlug(db, 'categories', fields.slug);
  }
  db.prepare('UPDATE categories SET slug = ?, name = ?, description = ? WHERE id = ?')
    .run(slug, fields.name, fields.description, id);
  return true;
}

export function deleteCategory(id) {
  return db.prepare('DELETE FROM categories WHERE id = ?').run(id).changes > 0;
}

export const reorderCategories = db.transaction((ids) => {
  const stmt = db.prepare('UPDATE categories SET position = ? WHERE id = ?');
  ids.forEach((id, i) => stmt.run(i, id));
});

/* ---- seiten und links ----------------------------------------------------- */

export function listAllPages() {
  return db.prepare(`
    SELECT slug, title, body, layout, tab_group, position, updated_at
    FROM pages ORDER BY tab_group ASC, position ASC, slug ASC
  `).all();
}

export function updatePage(slug, fields) {
  const exists = db.prepare('SELECT 1 FROM pages WHERE slug = ?').get(slug);
  if (!exists) return false;
  db.prepare(`
    UPDATE pages SET title = @title, body = @body, layout = @layout,
                     position = @position, tab_group = @tab_group,
                     updated_at = datetime('now')
    WHERE slug = @slug
  `).run({ ...fields, slug });
  return true;
}

export function createPage(fields) {
  const slug = uniqueSlug(db, 'pages', fields.slug || fields.title);
  db.prepare(`
    INSERT INTO pages (slug, title, body, layout, tab_group, position)
    VALUES (@slug, @title, @body, @layout, @tab_group, @position)
  `).run({ ...fields, slug });
  return slug;
}

export function deletePage(slug) {
  return db.prepare('DELETE FROM pages WHERE slug = ?').run(slug).changes > 0;
}

export function listLinks(pageSlug) {
  return db.prepare('SELECT id, label, url, note, position FROM links WHERE page_slug = ? ORDER BY position ASC, id ASC')
    .all(pageSlug);
}

export function createLink(pageSlug, fields) {
  const next = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM links WHERE page_slug = ?')
    .get(pageSlug).n;
  return db.prepare('INSERT INTO links (page_slug, label, url, note, position) VALUES (?, ?, ?, ?, ?)')
    .run(pageSlug, fields.label, fields.url, fields.note, next).lastInsertRowid;
}

export function updateLink(id, fields) {
  return db.prepare('UPDATE links SET label = ?, url = ?, note = ? WHERE id = ?')
    .run(fields.label, fields.url, fields.note, id).changes > 0;
}

export function deleteLink(id) {
  return db.prepare('DELETE FROM links WHERE id = ?').run(id).changes > 0;
}

export const reorderLinks = db.transaction((pageSlug, ids) => {
  const stmt = db.prepare('UPDATE links SET position = ? WHERE id = ? AND page_slug = ?');
  ids.forEach((id, i) => stmt.run(i, id, pageSlug));
});

/* ---- splashes ------------------------------------------------------------- */

export function listSplashes() {
  return db.prepare('SELECT id, text, active FROM splashes ORDER BY id DESC').all()
    .map((s) => ({ id: s.id, text: s.text, active: !!s.active }));
}

export function createSplash(text) {
  return db.prepare('INSERT INTO splashes (text) VALUES (?)').run(text).lastInsertRowid;
}

export function updateSplash(id, fields) {
  return db.prepare('UPDATE splashes SET text = ?, active = ? WHERE id = ?')
    .run(fields.text, fields.active, id).changes > 0;
}

export function deleteSplash(id) {
  return db.prepare('DELETE FROM splashes WHERE id = ?').run(id).changes > 0;
}

/* ---- shoutouts ------------------------------------------------------------ */

export function listAllShoutouts() {
  return db.prepare(`
    SELECT id, creator, title, kind, url, note, cover, youtube, published, shouted_at
    FROM shoutouts ORDER BY shouted_at DESC, id DESC
  `).all().map((s) => ({ ...s, published: !!s.published }));
}

export function createShoutout(fields) {
  return db.prepare(`
    INSERT INTO shoutouts (creator, title, kind, url, note, cover, youtube, published, shouted_at)
    VALUES (@creator, @title, @kind, @url, @note, @cover, @youtube, @published, @shouted_at)
  `).run(fields).lastInsertRowid;
}

export function updateShoutout(id, fields) {
  const before = db.prepare('SELECT cover FROM shoutouts WHERE id = ?').get(id);
  if (!before) return false;

  db.prepare(`
    UPDATE shoutouts SET creator = @creator, title = @title, kind = @kind, url = @url,
                         note = @note, cover = @cover, youtube = @youtube,
                         published = @published, shouted_at = @shouted_at
    WHERE id = @id
  `).run({ ...fields, id });

  // ausgetauschtes titelbild nicht liegen lassen
  if (before.cover && before.cover !== fields.cover) removeUpload(before.cover);
  return true;
}

export function deleteShoutout(id) {
  const row = db.prepare('SELECT cover FROM shoutouts WHERE id = ?').get(id);
  if (!row) return false;
  db.prepare('DELETE FROM shoutouts WHERE id = ?').run(id);
  removeUpload(row.cover);
  return true;
}
