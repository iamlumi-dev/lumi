// erzeugt url-taugliche slugs. alles klein — passt zur typografie-regel des style guides.
export function slugify(input) {
  return String(input)
    .toLowerCase()
    // deutsche umlaute zuerst ausschreiben, sonst frisst sie das NFKD-strippen zu "u"/"o"/"a"
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // uebrige diakritika entfernen
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// slugs, die mit echten dateien unter /public/portfolio/ kollidieren wuerden.
// ein post mit dem slug "index" waere sonst nicht erreichbar, weil express
// zuerst die statische datei ausliefert.
export const RESERVED_SLUGS = new Set(['index', 'post', 'admin', 'api', 'uploads', 'css', 'js']);

// haengt -2, -3 … an, bis der slug in der tabelle frei ist
export function uniqueSlug(db, table, base) {
  let root = slugify(base) || 'post';
  if (RESERVED_SLUGS.has(root)) root = `${root}-1`;
  const exists = db.prepare(`SELECT 1 FROM ${table} WHERE slug = ?`);
  let candidate = root;
  let n = 2;
  while (exists.get(candidate)) candidate = `${root}-${n++}`;
  return candidate;
}
