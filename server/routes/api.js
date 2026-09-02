// oeffentliche, lesende api. alles was hier raus geht ist bereits veroeffentlicht.
import { Router } from 'express';
import { listPosts, getPost, listCategories, neighbours, publicLayout, POST_SIZES } from '../lib/posts.js';
import { getPage, getPageGroup, navEntries } from '../lib/pages.js';
import { activeSplashes } from '../lib/splashes.js';
import { getViz } from '../lib/settings.js';
import { listShoutouts, shoutoutKindsInUse } from '../lib/shoutouts.js';

export const api = Router();

// der browser fragt jedes mal nach (max-age=0) und bekommt dank etag meist
// nur ein 304 zurueck — billig und immer aktuell. bewusst OHNE
// stale-while-revalidate: das lieferte nach dem anlegen bis zu eine minute
// lang noch den alten stand aus, was beim eigenen nachschauen nur verwirrt.
// s-maxage gilt nur fuer einen vorgeschalteten cache (cdn), nicht fuer den browser.
const cache = (seconds) => (req, res, next) => {
  res.set('Cache-Control', `public, max-age=0, s-maxage=${seconds}`);
  next();
};

api.get('/posts', cache(30), (req, res) => {
  let posts = listPosts();

  // optionaler serverseitiger filter (?category=slug,slug) — das frontend filtert
  // zusaetzlich clientseitig, damit das umschalten ohne request passiert.
  const raw = typeof req.query.category === 'string' ? req.query.category : '';
  const wanted = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (wanted.length) {
    posts = posts.filter((p) => p.categories.some((c) => wanted.includes(c.slug)));
  }

  // die anordnung kommt mit: zeilen mit spalten, spalten mit post-ids
  res.json({ posts, layout: publicLayout(), sizes: POST_SIZES });
});

api.get('/categories', cache(60), (req, res) => {
  res.json({ categories: listCategories() });
});

api.get('/posts/:slug', cache(30), (req, res) => {
  const post = getPost(req.params.slug);
  if (!post) return res.status(404).json({ error: 'not found' });
  res.json({ post, ...neighbours(post.slug) });
});

// --- aussehen des partikelfelds ---------------------------------------------
// gilt fuer die ganze seite, nicht je audiodatei
api.get('/viz', cache(60), (req, res) => res.json({ viz: getViz() }));

// --- navigation -------------------------------------------------------------
// jede seite holt sich ihre menuepunkte hierueber, statt sie im html zu haben
api.get('/nav', cache(60), (req, res) => {
  res.json({ nav: navEntries() });
});

// --- shoutouts --------------------------------------------------------------
api.get('/shoutouts', cache(30), (req, res) => {
  res.json({ shoutouts: listShoutouts(), kinds: shoutoutKindsInUse() });
});

// --- splash-texte -----------------------------------------------------------
// alle aktiven auf einmal. die startseite zieht daraus selbst eine zufaellige
// und kann bei jedem klick nachwuerfeln, ohne nochmal zu laden.
api.get('/splashes', cache(60), (req, res) => {
  res.json({ splashes: activeSplashes().map((s) => s.text) });
});

// --- freitext-seiten --------------------------------------------------------
// eine gruppe = die reiter einer seite. /about/ holt sich hierueber 'about'.
api.get('/pages/group/:group', cache(60), (req, res) => {
  const pages = getPageGroup(req.params.group);
  if (!pages.length) return res.status(404).json({ error: 'not found' });
  res.json({ pages });
});

api.get('/pages/:slug', cache(60), (req, res) => {
  const page = getPage(req.params.slug);
  if (!page) return res.status(404).json({ error: 'not found' });
  res.json({ page });
});

api.use((req, res) => res.status(404).json({ error: 'not found' }));
