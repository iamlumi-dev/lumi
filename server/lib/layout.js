// =========================================================================
// anordnung des portfolios
// =========================================================================
// eine zeile teilt ihre breite unter ihren spalten auf, eine spalte ihre
// hoehe unter ihren kacheln. beides summiert sich immer auf das ganze.
// deshalb kann kein platz uebrig bleiben — eine luecke ist in diesem modell
// nicht darstellbar, nicht bloss unwahrscheinlich.

import { db } from '../db.js';

export const MIN_UNITS = 1;
export const MAX_UNITS = 4;
export const MAX_WEIGHT = 8;

// wie viele spalten eine selbsttaetig gebaute zeile bekommt
const AUTO_PER_ROW = 2;

/* ---- schreiben ----------------------------------------------------------- */

export function createRow(units = 2) {
  const next = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM grid_rows').get().n;
  return db.prepare('INSERT INTO grid_rows (position, units) VALUES (?, ?)')
    .run(next, units).lastInsertRowid;
}

export function updateRow(id, units) {
  return db.prepare('UPDATE grid_rows SET units = ? WHERE id = ?').run(units, id).changes > 0;
}

// beim loeschen einer zeile werden ihre posts wieder frei, nicht geloescht
export const deleteRow = db.transaction((id) => {
  const cells = db.prepare('SELECT id FROM grid_cells WHERE row_id = ?').all(id);
  const free = db.prepare('UPDATE posts SET cell_id = NULL WHERE cell_id = ?');
  for (const cell of cells) free.run(cell.id);
  return db.prepare('DELETE FROM grid_rows WHERE id = ?').run(id).changes > 0;
});

export const reorderRows = db.transaction((ids) => {
  const stmt = db.prepare('UPDATE grid_rows SET position = ? WHERE id = ?');
  ids.forEach((id, i) => stmt.run(i, id));
});

export function createCell(rowId, weight = 1) {
  const next = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM grid_cells WHERE row_id = ?')
    .get(rowId).n;
  return db.prepare('INSERT INTO grid_cells (row_id, position, weight) VALUES (?, ?, ?)')
    .run(rowId, next, weight).lastInsertRowid;
}

export function updateCell(id, weight) {
  return db.prepare('UPDATE grid_cells SET weight = ? WHERE id = ?').run(weight, id).changes > 0;
}

export const deleteCell = db.transaction((id) => {
  db.prepare('UPDATE posts SET cell_id = NULL WHERE cell_id = ?').run(id);
  return db.prepare('DELETE FROM grid_cells WHERE id = ?').run(id).changes > 0;
});

export const reorderCells = db.transaction((rowId, ids) => {
  const stmt = db.prepare('UPDATE grid_cells SET position = ? WHERE id = ? AND row_id = ?');
  ids.forEach((id, i) => stmt.run(i, id, rowId));
});

/** legt einen post in eine spalte, an eine bestimmte stelle */
export const placePost = db.transaction((postId, cellId, slot = null) => {
  if (cellId === null) {
    db.prepare('UPDATE posts SET cell_id = NULL, slot = 0 WHERE id = ?').run(postId);
    return;
  }
  const at = slot ?? db.prepare(
    'SELECT COALESCE(MAX(slot), -1) + 1 AS n FROM posts WHERE cell_id = ?'
  ).get(cellId).n;
  db.prepare('UPDATE posts SET cell_id = ?, slot = ? WHERE id = ?').run(cellId, at, postId);
});

export const reorderInCell = db.transaction((cellId, ids) => {
  const stmt = db.prepare('UPDATE posts SET slot = ? WHERE id = ? AND cell_id = ?');
  ids.forEach((id, i) => stmt.run(i, id, cellId));
});

/**
 * baut die anordnung komplett neu: jeder veroeffentlichte post kommt in eine
 * eigene spalte, je AUTO_PER_ROW spalten eine zeile. bestehende zeilen werden
 * dabei verworfen — die posts selbst nie.
 */
export const autoArrange = db.transaction((orderedPostIds) => {
  db.prepare('UPDATE posts SET cell_id = NULL, slot = 0').run();
  db.prepare('DELETE FROM grid_cells').run();
  db.prepare('DELETE FROM grid_rows').run();

  const newRow = db.prepare('INSERT INTO grid_rows (position, units) VALUES (?, ?)');
  const newCell = db.prepare('INSERT INTO grid_cells (row_id, position, weight) VALUES (?, ?, 1)');
  const place = db.prepare('UPDATE posts SET cell_id = ?, slot = 0 WHERE id = ?');

  let rowIndex = 0;
  for (let i = 0; i < orderedPostIds.length; i += AUTO_PER_ROW) {
    const chunk = orderedPostIds.slice(i, i + AUTO_PER_ROW);
    const rowId = newRow.run(rowIndex++, 2).lastInsertRowid;
    chunk.forEach((postId, j) => {
      const cellId = newCell.run(rowId, j).lastInsertRowid;
      place.run(cellId, postId);
    });
  }
  return rowIndex;
});

/* ---- ansicht fuer den editor ---------------------------------------------- */

export function adminLayout() {
  const rows = db.prepare('SELECT id, position, units FROM grid_rows ORDER BY position ASC, id ASC').all();
  const cells = db.prepare(
    'SELECT id, row_id, position, weight FROM grid_cells ORDER BY position ASC, id ASC'
  ).all();
  const posts = db.prepare(`
    SELECT id, title, slug, size, published, cell_id, slot
    FROM posts ORDER BY slot ASC, published_at DESC, id DESC
  `).all();

  const inCell = new Map(cells.map((c) => [c.id, []]));
  const loose = [];
  for (const p of posts) {
    const entry = { id: p.id, title: p.title, slug: p.slug, published: !!p.published };
    if (p.cell_id && inCell.has(p.cell_id)) inCell.get(p.cell_id).push({ ...entry, slot: p.slot });
    else loose.push(entry);
  }
  for (const list of inCell.values()) list.sort((a, b) => a.slot - b.slot || a.id - b.id);

  const cellsOfRow = new Map(rows.map((r) => [r.id, []]));
  for (const c of cells) {
    cellsOfRow.get(c.row_id)?.push({ id: c.id, weight: c.weight, posts: inCell.get(c.id) });
  }

  return {
    rows: rows.map((r) => ({ id: r.id, units: r.units, cells: cellsOfRow.get(r.id) || [] })),
    loose,
    limits: { minUnits: MIN_UNITS, maxUnits: MAX_UNITS, maxWeight: MAX_WEIGHT },
  };
}
