// oeffentliche, lesende api. alles was hier raus geht ist bereits veroeffentlicht.
import { Router } from 'express';
import { listPosts, getPost, listCategories, neighbours, POST_SIZES } from '../lib/posts.js';

export const api = Router();

// kurz cachen: entlastet den server, aber neue posts sind schnell sichtbar
const cache = (seconds) => (req, res, next) => {
  res.set('Cache-Control', `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=60`);
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

  res.json({ posts, sizes: POST_SIZES });
});

api.get('/categories', cache(60), (req, res) => {
  res.json({ categories: listCategories() });
});

api.get('/posts/:slug', cache(30), (req, res) => {
  const post = getPost(req.params.slug);
  if (!post) return res.status(404).json({ error: 'not found' });
  res.json({ post, ...neighbours(post.slug) });
});

api.use((req, res) => res.status(404).json({ error: 'not found' }));
