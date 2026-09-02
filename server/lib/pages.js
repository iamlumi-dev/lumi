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
  SELECT label, url, note FROM links WHERE page_slug = ? ORDER BY position ASC, id ASC
`);

// mailadressen werden zerlegt ausgeliefert: weder im html noch in der
// api-antwort steht jemals "name@domain" am stueck. der browser setzt sie
// erst beim klick zusammen.
//
// das haelt harvester ab, die quelltext oder json nach mailmustern absuchen —
// also die grosse mehrheit. gegen einen scraper, der die seite rendert und
// javascript ausfuehrt, hilft es nicht. mehr ist ohne kontaktformular auch
// nicht drin.
function protectMail(link) {
  const m = /^mailto:([^@]+)@(.+)$/i.exec(link.url.trim());
  if (!m) return { label: link.label, url: link.url, note: link.note };
  return { label: link.label, note: link.note, mail: { user: m[1], domain: m[2] } };
}

function hydrate(row) {
  if (!row) return null;
  return {
    slug: row.slug,
    title: row.title,
    body: row.body,
    layout: row.layout,
    updatedAt: row.updated_at,
    // nur das 'links'-layout braucht sie; bei den anderen bleibt die liste leer
    links: row.layout === 'links' ? selectLinks.all(row.slug).map(protectMail) : [],
  };
}

export function getPage(slug) {
  return hydrate(selectPage.get(slug));
}

// alle reiter einer seite, in der gesetzten reihenfolge
export function getPageGroup(group) {
  return selectGroup.all(group).map(hydrate);
}

/* ---- navigation -----------------------------------------------------------
   die menuepunkte kommen aus der datenbank, nicht aus den html-dateien.
   eine seite taucht auf, sobald ihre position groesser als 0 ist; 0 heisst
   "nicht anzeigen". reiter einer seite (gruppen mit mehreren eintraegen)
   zaehlen nicht mit — dort ordnet position die reiter, nicht das menue.       */

// ziele, die keine seite in der datenbank sind und deshalb fest stehen
const FIXED = [
  { label: 'work', href: '/portfolio/', position: 0 },
];

export function navEntries() {
  const groups = db.prepare(`
    SELECT tab_group, COUNT(*) AS n FROM pages WHERE tab_group != '' GROUP BY tab_group
  `).all();
  const single = new Set(groups.filter((g) => g.n === 1).map((g) => g.tab_group));

  const pages = db.prepare(`
    SELECT slug, title, tab_group, position FROM pages WHERE position > 0
  `).all()
    .filter((p) => single.has(p.tab_group))
    .map((p) => ({ label: p.title, href: `/${p.slug}/`, position: p.position }));

  // die about-seite hat mehrere reiter und deshalb keine eigene positionszeile
  const about = db.prepare("SELECT title FROM pages WHERE slug = 'about'").get();
  const fixed = [...FIXED];
  if (about) fixed.push({ label: 'about me', href: '/about/', position: 0.5 });

  return [...fixed, ...pages]
    .sort((a, b) => a.position - b.position || a.label.localeCompare(b.label))
    .map(({ label, href }) => ({ label, href }));
}
