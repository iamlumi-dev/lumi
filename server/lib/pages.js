// lese-zugriff auf freitext-seiten (about me und was noch dazukommt).
import { db } from '../db.js';

export const PAGE_LAYOUTS = ['prose', 'list', 'links'];

const selectPage = db.prepare(`
  SELECT slug, title, body, layout, tab_group, position, updated_at
  FROM pages WHERE slug = ?
`);

const selectGroup = db.prepare(`
  SELECT slug, title, body, layout, tab_group, position, updated_at
  FROM pages WHERE tab_group = ?
  ORDER BY position ASC, slug ASC
`);

const selectLinks = db.prepare(`
  SELECT label, url FROM links WHERE page_slug = ? ORDER BY position ASC, id ASC
`);

function hydrate(row) {
  if (!row) return null;
  return {
    slug: row.slug,
    title: row.title,
    body: row.body,
    layout: row.layout,
    updatedAt: row.updated_at,
    // nur das 'links'-layout braucht sie; bei den anderen bleibt die liste leer
    links: row.layout === 'links' ? selectLinks.all(row.slug) : [],
  };
}

export function getPage(slug) {
  return hydrate(selectPage.get(slug));
}

// alle reiter einer seite, in der gesetzten reihenfolge
export function getPageGroup(group) {
  return selectGroup.all(group).map(hydrate);
}
