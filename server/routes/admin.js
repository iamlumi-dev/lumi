// =========================================================================
// geschuetzte schreib-api
// =========================================================================
// jede route hier setzt eine gueltige session UND das csrf-token voraus;
// beides haengt bereits als middleware davor (siehe server/index.js).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';

import { config } from '../config.js';
import { db } from '../db.js';
import { POST_SIZES, listCategories } from '../lib/posts.js';
import { PAGE_LAYOUTS } from '../lib/pages.js';
import { SHOUTOUT_KINDS } from '../lib/shoutouts.js';
import * as store from '../lib/write.js';
import { BadRequest, str, oneOf, bool, int, intList, dateTime, url, youtubeId } from '../lib/validate.js';

export const admin = Router();

// kleine hilfe: wirft BadRequest sauber als 400 zurueck
const handle = (fn) => (req, res, next) => {
  try {
    fn(req, res, next);
  } catch (err) {
    if (err instanceof BadRequest) return res.status(400).json({ error: err.message });
    next(err);
  }
};

/* =======================================================================
   posts
   ======================================================================= */

function postFields(body) {
  return {
    title: str(body.title, 'titel', { min: 1, max: 200 }),
    slug: body.slug === undefined ? undefined : str(body.slug, 'slug', { max: 80 }),
    summary: str(body.summary, 'kurztext', { max: 500 }),
    body: str(body.body, 'text', { max: 20000 }),
    size: oneOf(str(body.size || 'small', 'größe'), 'größe', POST_SIZES),
    pinned: bool(body.pinned),
    published: bool(body.published),
    published_at: dateTime(body.publishedAt || new Date().toISOString().slice(0, 10), 'datum'),
    categories: intList(body.categories || [], 'kategorien'),
  };
}

admin.get('/posts', (req, res) => res.json({ posts: store.listAllPosts(), sizes: POST_SIZES }));

admin.get('/posts/:id', handle((req, res) => {
  const post = store.getPostAdmin(int(req.params.id, 'id'));
  if (!post) return res.status(404).json({ error: 'nicht gefunden' });
  res.json({ post });
}));

admin.post('/posts', handle((req, res) => {
  res.status(201).json({ post: store.createPost(postFields(req.body || {})) });
}));

admin.patch('/posts/:id', handle((req, res) => {
  const post = store.updatePost(int(req.params.id, 'id'), postFields(req.body || {}));
  if (!post) return res.status(404).json({ error: 'nicht gefunden' });
  res.json({ post });
}));

admin.delete('/posts/:id', handle((req, res) => {
  if (!store.deletePost(int(req.params.id, 'id'))) {
    return res.status(404).json({ error: 'nicht gefunden' });
  }
  res.json({ ok: true });
}));

/* =======================================================================
   medien
   ======================================================================= */

admin.post('/posts/:id/media', handle((req, res) => {
  const postId = int(req.params.id, 'id');
  if (!db.prepare('SELECT 1 FROM posts WHERE id = ?').get(postId)) {
    return res.status(404).json({ error: 'post nicht gefunden' });
  }

  const body = req.body || {};
  const kind = oneOf(str(body.kind, 'art'), 'art', ['image', 'video', 'audio', 'youtube']);

  // bei youtube wird nur die video-id gespeichert, nie eine fremde adresse
  const src = kind === 'youtube'
    ? youtubeId(body.src, 'youtube-adresse')
    : url(body.src, 'quelle');

  const id = store.addMedia(postId, {
    kind,
    src,
    poster: body.poster ? url(body.poster, 'standbild') : null,
    alt: str(body.alt, 'alternativtext', { max: 300 }),
    caption: str(body.caption, 'bildunterschrift', { max: 300 }),
    is_cover: bool(body.isCover),
  });

  res.status(201).json({ id, media: store.listMedia(postId) });
}));

admin.patch('/media/:id', handle((req, res) => {
  const body = req.body || {};
  const ok = store.updateMedia(int(req.params.id, 'id'), {
    alt: str(body.alt, 'alternativtext', { max: 300 }),
    caption: str(body.caption, 'bildunterschrift', { max: 300 }),
    is_cover: bool(body.isCover),
  });
  if (!ok) return res.status(404).json({ error: 'nicht gefunden' });
  res.json({ ok: true });
}));

admin.delete('/media/:id', handle((req, res) => {
  if (!store.deleteMedia(int(req.params.id, 'id'))) {
    return res.status(404).json({ error: 'nicht gefunden' });
  }
  res.json({ ok: true });
}));

admin.post('/posts/:id/media/order', handle((req, res) => {
  const postId = int(req.params.id, 'id');
  store.reorderMedia(postId, intList(req.body?.ids || [], 'reihenfolge'));
  res.json({ media: store.listMedia(postId) });
}));

/* =======================================================================
   datei-upload
   ======================================================================= */

// erlaubte typen. schluessel ist der mime-typ, wert die endung, die wir
// selbst vergeben — die vom nutzer gelieferte endung wird nie uebernommen.
const ALLOWED = {
  'image/jpeg': ['.jpg', 'image'],
  'image/png': ['.png', 'image'],
  'image/webp': ['.webp', 'image'],
  'image/avif': ['.avif', 'image'],
  'image/gif': ['.gif', 'image'],
  'video/mp4': ['.mp4', 'video'],
  'video/webm': ['.webm', 'video'],
  'video/quicktime': ['.mov', 'video'],
  'audio/mpeg': ['.mp3', 'audio'],
  'audio/wav': ['.wav', 'audio'],
  'audio/x-wav': ['.wav', 'audio'],
  'audio/flac': ['.flac', 'audio'],
  'audio/ogg': ['.ogg', 'audio'],
  'audio/mp4': ['.m4a', 'audio'],
};
// svg fehlt hier mit absicht: svg kann skripte enthalten.

const uploadDir = path.join(config.uploadsDir, 'media');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    // eigener name aus zufall + datum. der originalname geht nie in den
    // dateipfad ein, damit daraus kein "../" werden kann.
    filename: (req, file, cb) => {
      const ext = ALLOWED[file.mimetype]?.[0] || '.bin';
      const stamp = new Date().toISOString().slice(0, 10);
      cb(null, `${stamp}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    },
  }),
  limits: {
    // 0 in der konfiguration heisst: kein limit
    fileSize: config.maxUploadMb > 0 ? config.maxUploadMb * 1024 * 1024 : Infinity,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) {
      return cb(new BadRequest(`dateityp ${file.mimetype} ist nicht erlaubt`));
    }
    cb(null, true);
  },
});

// eine datei pro anfrage — nur so bekommt jede ihren eigenen fortschritt
admin.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof BadRequest) return res.status(400).json({ error: err.message });
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `datei ist größer als ${config.maxUploadMb} MB` });
      }
      return next(err);
    }
    if (!req.file) return res.status(400).json({ error: 'keine datei angekommen' });

    res.status(201).json({
      src: `/uploads/media/${req.file.filename}`,
      kind: ALLOWED[req.file.mimetype][1],
      bytes: req.file.size,
      originalName: req.file.originalname,
    });
  });
});

admin.get('/upload/limits', (req, res) => {
  res.json({
    maxUploadMb: config.maxUploadMb,          // 0 = kein limit
    accept: Object.keys(ALLOWED),
  });
});

/* =======================================================================
   kategorien
   ======================================================================= */

admin.get('/categories', (req, res) => res.json({ categories: listCategories() }));

admin.post('/categories', handle((req, res) => {
  const body = req.body || {};
  const id = store.createCategory({
    name: str(body.name, 'name', { min: 1, max: 60 }),
    slug: body.slug,
    description: str(body.description, 'beschreibung', { max: 200 }),
  });
  res.status(201).json({ id, categories: listCategories() });
}));

admin.patch('/categories/:id', handle((req, res) => {
  const body = req.body || {};
  const ok = store.updateCategory(int(req.params.id, 'id'), {
    name: str(body.name, 'name', { min: 1, max: 60 }),
    slug: body.slug,
    description: str(body.description, 'beschreibung', { max: 200 }),
  });
  if (!ok) return res.status(404).json({ error: 'nicht gefunden' });
  res.json({ categories: listCategories() });
}));

admin.delete('/categories/:id', handle((req, res) => {
  if (!store.deleteCategory(int(req.params.id, 'id'))) {
    return res.status(404).json({ error: 'nicht gefunden' });
  }
  res.json({ categories: listCategories() });
}));

admin.post('/categories/order', handle((req, res) => {
  store.reorderCategories(intList(req.body?.ids || [], 'reihenfolge'));
  res.json({ categories: listCategories() });
}));

/* =======================================================================
   seiten und links
   ======================================================================= */

admin.get('/pages', (req, res) => res.json({ pages: store.listAllPages() }));

admin.patch('/pages/:slug', handle((req, res) => {
  const body = req.body || {};
  const ok = store.updatePage(str(req.params.slug, 'slug', { max: 80 }), {
    title: str(body.title, 'titel', { min: 1, max: 80 }),
    body: str(body.body, 'text', { max: 20000 }),
    layout: oneOf(str(body.layout || 'prose', 'layout'), 'layout', PAGE_LAYOUTS),
    position: int(body.position ?? 0, 'position', { min: 0, max: 999 }),
  });
  if (!ok) return res.status(404).json({ error: 'nicht gefunden' });
  res.json({ pages: store.listAllPages() });
}));

admin.post('/pages', handle((req, res) => {
  const body = req.body || {};
  const slug = store.createPage({
    title: str(body.title, 'titel', { min: 1, max: 80 }),
    slug: body.slug,
    body: str(body.body, 'text', { max: 20000 }),
    layout: oneOf(str(body.layout || 'prose', 'layout'), 'layout', PAGE_LAYOUTS),
    tab_group: str(body.tabGroup, 'gruppe', { max: 40 }),
    position: int(body.position ?? 0, 'position', { min: 0, max: 999 }),
  });
  res.status(201).json({ slug, pages: store.listAllPages() });
}));

admin.delete('/pages/:slug', handle((req, res) => {
  if (!store.deletePage(str(req.params.slug, 'slug', { max: 80 }))) {
    return res.status(404).json({ error: 'nicht gefunden' });
  }
  res.json({ pages: store.listAllPages() });
}));

admin.get('/pages/:slug/links', handle((req, res) => {
  res.json({ links: store.listLinks(str(req.params.slug, 'slug', { max: 80 })) });
}));

admin.post('/pages/:slug/links', handle((req, res) => {
  const slug = str(req.params.slug, 'slug', { max: 80 });
  const body = req.body || {};
  store.createLink(slug, {
    label: str(body.label, 'beschriftung', { min: 1, max: 60 }),
    url: url(body.url, 'adresse'),
    note: str(body.note, 'notiz', { max: 200 }),
  });
  res.status(201).json({ links: store.listLinks(slug) });
}));

admin.patch('/links/:id', handle((req, res) => {
  const body = req.body || {};
  const ok = store.updateLink(int(req.params.id, 'id'), {
    label: str(body.label, 'beschriftung', { min: 1, max: 60 }),
    url: url(body.url, 'adresse'),
    note: str(body.note, 'notiz', { max: 200 }),
  });
  if (!ok) return res.status(404).json({ error: 'nicht gefunden' });
  res.json({ ok: true });
}));

admin.delete('/links/:id', handle((req, res) => {
  if (!store.deleteLink(int(req.params.id, 'id'))) {
    return res.status(404).json({ error: 'nicht gefunden' });
  }
  res.json({ ok: true });
}));

admin.post('/pages/:slug/links/order', handle((req, res) => {
  const slug = str(req.params.slug, 'slug', { max: 80 });
  store.reorderLinks(slug, intList(req.body?.ids || [], 'reihenfolge'));
  res.json({ links: store.listLinks(slug) });
}));

/* =======================================================================
   shoutouts
   ======================================================================= */

function shoutoutFields(body) {
  const link = body.url ? url(body.url, 'adresse') : '';

  // ist die adresse ein youtube-link, merken wir uns die video-id — das
  // vorschaubild kommt dann von dort, wenn kein eigenes cover gesetzt ist
  let youtube = null;
  if (link) {
    try { youtube = youtubeId(link, 'adresse'); } catch { youtube = null; }
  }

  return {
    creator: str(body.creator, 'wer', { min: 1, max: 120 }),
    title: str(body.title, 'was', { max: 200 }),
    kind: oneOf(str(body.kind || 'song', 'art'), 'art', SHOUTOUT_KINDS),
    url: link,
    note: str(body.note, 'notiz', { max: 1000 }),
    // nur pfade unter /uploads/ — kein fremdes bild einbetten, das waere
    // eine csp-verletzung und ein zaehlpixel fuer den fremden server
    cover: body.cover ? url(body.cover, 'titelbild', { allowRelative: true }) : null,
    youtube,
    published: bool(body.published),
    shouted_at: (dateTime(body.date || new Date().toISOString().slice(0, 10), 'datum') || '').slice(0, 10),
  };
}

admin.get('/shoutouts', (req, res) =>
  res.json({ shoutouts: store.listAllShoutouts(), kinds: SHOUTOUT_KINDS }));

admin.post('/shoutouts', handle((req, res) => {
  store.createShoutout(shoutoutFields(req.body || {}));
  res.status(201).json({ shoutouts: store.listAllShoutouts() });
}));

admin.patch('/shoutouts/:id', handle((req, res) => {
  if (!store.updateShoutout(int(req.params.id, 'id'), shoutoutFields(req.body || {}))) {
    return res.status(404).json({ error: 'nicht gefunden' });
  }
  res.json({ shoutouts: store.listAllShoutouts() });
}));

admin.delete('/shoutouts/:id', handle((req, res) => {
  if (!store.deleteShoutout(int(req.params.id, 'id'))) {
    return res.status(404).json({ error: 'nicht gefunden' });
  }
  res.json({ shoutouts: store.listAllShoutouts() });
}));

/* =======================================================================
   splash-texte
   ======================================================================= */

admin.get('/splashes', (req, res) => res.json({ splashes: store.listSplashes() }));

admin.post('/splashes', handle((req, res) => {
  // kein laengenlimit: ein splash darf ueber den bildschirmrand hinauslaufen.
  // die 10000 zeichen aus str() bleiben als reine notbremse stehen.
  store.createSplash(str(req.body?.text, 'splash', { min: 1, trim: false }));
  res.status(201).json({ splashes: store.listSplashes() });
}));

admin.patch('/splashes/:id', handle((req, res) => {
  const body = req.body || {};
  const ok = store.updateSplash(int(req.params.id, 'id'), {
    text: str(body.text, 'splash', { min: 1, trim: false }),
    active: bool(body.active),
  });
  if (!ok) return res.status(404).json({ error: 'nicht gefunden' });
  res.json({ splashes: store.listSplashes() });
}));

admin.delete('/splashes/:id', handle((req, res) => {
  if (!store.deleteSplash(int(req.params.id, 'id'))) {
    return res.status(404).json({ error: 'nicht gefunden' });
  }
  res.json({ splashes: store.listSplashes() });
}));

/* ----------------------------------------------------------------------- */

admin.use((req, res) => res.status(404).json({ error: 'nicht gefunden' }));
