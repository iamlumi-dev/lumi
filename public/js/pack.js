/*=== GRID-PACKER ===*/
/* ordnet die kacheln des portfolios an und laesst dabei keine luecke stehen.
 *
 * "grid-auto-flow: dense" allein reicht nicht: es fuellt loecher nur mit
 * spaeteren, kleineren kacheln nach. bleibt keine passende uebrig — und am
 * ende einer liste bleibt fast immer keine uebrig — steht das loch da.
 *
 * hier passiert deshalb zweierlei:
 *   1. erst wird ganz normal gepackt (first fit, dieselbe reihenfolge wie
 *      der nutzer sie sortiert hat)
 *   2. danach werden verbleibende loecher geschlossen, indem eine
 *      benachbarte kachel darauf ausgedehnt wird
 *
 * die gewaehlte groesse ist damit ein wunsch, keine garantie — eine kachel
 * kann am rand groesser werden, als sie bestellt wurde. sie wird nie kleiner.
 */
window.__pack = (function () {
  // wunschgroesse je einstellung, in zellen (breite × hoehe)
  const SIZES = {
    small: [1, 1],
    wide: [2, 1],
    tall: [1, 2],
    large: [2, 2],
    banner: [Infinity, 1],   // volle breite
  };

  const MAX_ROW_SPAN = 3;    // obergrenze fuers ausdehnen, damit nichts entgleist

  function wanted(size, cols) {
    // bei einer spalte wird alles ein quadrat, sonst wird die seite endlos
    if (cols === 1) return [1, 1];
    const [w, h] = SIZES[size] || SIZES.small;
    return [Math.min(w, cols), Math.min(h, 2)];
  }

  /* ---- belegungsraster ---------------------------------------------------- */

  function makeGrid(cols) {
    const rows = [];
    const ensure = (r) => { while (rows.length <= r) rows.push(new Array(cols).fill(null)); };

    return {
      cols,
      rows,
      ensure,
      free(r, c, w, h) {
        if (c < 0 || c + w > cols || r < 0) return false;
        ensure(r + h - 1);
        for (let y = r; y < r + h; y++) {
          for (let x = c; x < c + w; x++) if (rows[y][x]) return false;
        }
        return true;
      },
      put(item) {
        ensure(item.r + item.h - 1);
        for (let y = item.r; y < item.r + item.h; y++) {
          for (let x = item.c; x < item.c + item.w; x++) rows[y][x] = item;
        }
      },
      at(r, c) {
        return r >= 0 && r < rows.length && c >= 0 && c < cols ? rows[r][c] : undefined;
      },
      get height() { return rows.length; },
    };
  }

  /* ---- schritt 1: first fit ----------------------------------------------- */

  function place(grid, items) {
    for (const item of items) {
      let found = false;
      for (let r = 0; !found; r++) {
        grid.ensure(r);
        for (let c = 0; c <= grid.cols - item.w; c++) {
          if (grid.free(r, c, item.w, item.h)) {
            item.r = r;
            item.c = c;
            grid.put(item);
            found = true;
            break;
          }
        }
      }
    }
  }

  /* ---- schritt 2: loecher schliessen -------------------------------------- */

  /* je richtung ein paar: "kann" liefert, wie viele zellen der zug fuellen
     wuerde (0 = geht nicht), "tu" fuehrt ihn aus. entscheidend ist, dass der
     zug gewaehlt wird, der am MEISTEN fuellt — wer stur den nachbarn ueber dem
     loch nimmt, verbaut sich das nachbarloch und bleibt stecken. */

  const MOVES = {
    // nach unten verlaengern: die ganze naechste zeile muss ueber die
    // volle breite der kachel frei sein
    down: {
      can(grid, t, cap) {
        const r = t.r + t.h;
        if (t.h >= cap || r >= grid.height) return 0;
        for (let x = t.c; x < t.c + t.w; x++) if (grid.rows[r][x]) return 0;
        return t.w;
      },
      do(grid, t) { t.h += 1; grid.put(t); },
    },

    // nach rechts verbreitern
    right: {
      can(grid, t) {
        const c = t.c + t.w;
        if (c >= grid.cols) return 0;
        for (let y = t.r; y < t.r + t.h; y++) if (grid.rows[y][c]) return 0;
        return t.h;
      },
      do(grid, t) { t.w += 1; grid.put(t); },
    },

    // nach links verbreitern
    left: {
      can(grid, t) {
        const c = t.c - 1;
        if (c < 0) return 0;
        for (let y = t.r; y < t.r + t.h; y++) if (grid.rows[y][c]) return 0;
        return t.h;
      },
      do(grid, t) { t.c -= 1; t.w += 1; grid.put(t); },
    },

    // nach oben verlaengern
    up: {
      can(grid, t, cap) {
        const r = t.r - 1;
        if (r < 0 || t.h >= cap) return 0;
        for (let x = t.c; x < t.c + t.w; x++) if (grid.rows[r][x]) return 0;
        return t.w;
      },
      do(grid, t) { t.r -= 1; t.h += 1; grid.put(t); },
    },
  };

  // alle zusammenhaengenden freien zellen ab einem loch. die erste zelle
  // eines lochs kann eingemauert sein, waehrend eine andere zelle desselben
  // lochs offen ist — deshalb wird die ganze flaeche betrachtet.
  function holeRegion(grid, start) {
    const seen = new Set();
    const key = (r, c) => r * grid.cols + c;
    const stack = [start];
    const cells = [];
    seen.add(key(start.r, start.c));

    while (stack.length) {
      const cell = stack.pop();
      cells.push(cell);
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const r = cell.r + dr;
        const c = cell.c + dc;
        if (r < 0 || r >= grid.height || c < 0 || c >= grid.cols) continue;
        if (grid.rows[r][c] || seen.has(key(r, c))) continue;
        seen.add(key(r, c));
        stack.push({ r, c });
      }
    }
    return cells;
  }

  function firstHole(grid) {
    for (let r = 0; r < grid.height; r++) {
      for (let c = 0; c < grid.cols; c++) if (!grid.rows[r][c]) return { r, c };
    }
    return null;
  }

  // eine restlos leere zeile ist nur ein rechenrest und wird abgeschnitten
  function trimEmptyRow(grid, r) {
    if (!grid.rows[r].every((cell) => !cell)) return false;
    grid.rows.splice(r, 1);
    const seen = new Set();
    for (const t of grid.rows.flat()) {
      if (t && !seen.has(t) && t.r > r) { seen.add(t); t.r -= 1; }
    }
    return true;
  }

  function closeHoles(grid) {
    // erst mit maßvoller obergrenze fuers verlaengern, und nur wenn das
    // stecken bleibt ohne. so bleibt es in der regel ruhig und wird nur im
    // notfall haesslich.
    for (const cap of [MAX_ROW_SPAN, Infinity]) {
      // die schranke ist nur ein notausgang gegen endlosschleifen; jeder
      // durchgang fuellt mindestens eine zelle
      for (let guard = 0; guard < grid.cols * grid.height * 4 + 64; guard++) {
        const hole = firstHole(grid);
        if (!hole) return true;

        // jede randkachel der gesamten lochflaeche kommt in frage
        let best = null;
        for (const cell of holeRegion(grid, hole)) {
          const around = [
            ['down', grid.at(cell.r - 1, cell.c)],
            ['right', grid.at(cell.r, cell.c - 1)],
            ['left', grid.at(cell.r, cell.c + 1)],
            ['up', grid.at(cell.r + 1, cell.c)],
          ];
          for (const [dir, tile] of around) {
            if (!tile) continue;
            const gain = MOVES[dir].can(grid, tile, cap);
            if (gain > (best ? best.gain : 0)) best = { dir, tile, gain };
          }
        }

        if (best) { MOVES[best.dir].do(grid, best.tile); continue; }
        if (trimEmptyRow(grid, hole.r)) continue;
        break;   // mit dieser obergrenze nicht zu schaffen → naechste
      }
    }
    return !firstHole(grid);
  }

  /* ---- oeffentliche schnittstelle ----------------------------------------- */

  /**
   * @param {{size: string}[]} entries  in der reihenfolge, in der sie stehen sollen
   * @param {number} cols
   * @returns {{r,c,w,h}[]} platzierung je eintrag, gleiche reihenfolge — oder
   *                        null, wenn sich nicht lueckenlos packen liess
   */
  function attempt(entries, cols, flatten) {
    const items = entries.map((e, i) => {
      const [w, h] = wanted(e.size, cols);
      return { i, w, h: flatten ? 1 : h, r: 0, c: 0 };
    });

    const grid = makeGrid(cols);
    place(grid, items);
    return closeHoles(grid) ? items.map(({ r, c, w, h }) => ({ r, c, w, h })) : null;
  }

  function pack(entries, cols) {
    if (!entries.length || cols < 1) return [];

    // erster versuch mit den gewuenschten hoehen
    const first = attempt(entries, cols, false);
    if (first) return first;

    // rueckfall: alle kacheln einzeilig. dann ist jede zeile ein reines
    // breiten-problem, und ein rest am zeilenende laesst sich immer schliessen,
    // indem die letzte kachel der zeile breiter wird. das geht also immer auf —
    // um den preis, dass "tall" und "large" hier ihre hoehe verlieren.
    return attempt(entries, cols, true);
  }

  return { pack, SIZES: Object.keys(SIZES) };
})();
