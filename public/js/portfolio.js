/*=== PORTFOLIO — grid, filter, sortierung ===*/
(function () {
  const grid = document.getElementById('grid');
  const filterRow = document.getElementById('filterRow');
  const sortRow = document.getElementById('sortRow');
  const statusEl = document.getElementById('status');
  const emptyEl = document.getElementById('empty');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FADE = reduceMotion ? 0 : 300;

  let posts = [];
  let active = new Set();          // ausgewaehlte kategorie-slugs (leer = alle)
  let sort = 'arranged';           // 'arranged' = die eigene anordnung
  let layoutData = null;
  const tiles = new Map();         // slug -> <li>

  /* ---- daten holen ------------------------------------------------------ */
  async function load() {
    try {
      const [postsRes, catsRes] = await Promise.all([
        fetch('/api/posts'),
        fetch('/api/categories'),
      ]);
      if (!postsRes.ok || !catsRes.ok) throw new Error('api');

      const postsData = await postsRes.json();
      posts = postsData.posts;
      layoutData = postsData.layout || null;
      const categories = (await catsRes.json()).categories;

      readUrl(categories);
      renderFilters(categories);
      buildTiles();
      apply(false);
    } catch (err) {
      statusEl.textContent = 'could not load the work … try reloading';
      console.error(err);
    }
  }

  /* ---- zustand aus der url lesen / schreiben ---------------------------- */
  // filter sind so teilbar: /portfolio/?c=sound,motion&sort=oldest
  function readUrl(categories) {
    const params = new URLSearchParams(location.search);
    const known = new Set(categories.map((c) => c.slug));
    (params.get('c') || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => known.has(s))
      .forEach((s) => active.add(s));

    const s = params.get('sort');
    if (['arranged', 'newest', 'oldest', 'title'].includes(s)) sort = s;
  }

  function writeUrl() {
    const params = new URLSearchParams();
    if (active.size) params.set('c', [...active].join(','));
    if (sort !== 'arranged') params.set('sort', sort);
    const qs = params.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }

  /* ---- filter-chips ----------------------------------------------------- */
  function renderFilters(categories) {
    for (const cat of categories) {
      if (!cat.count) continue;               // leere kategorien nicht anbieten
      const b = document.createElement('button');
      b.className = 'chip';
      b.dataset.filter = cat.slug;
      b.textContent = `${cat.name} (${cat.count})`;
      if (cat.description) b.title = cat.description;
      b.setAttribute('aria-pressed', String(active.has(cat.slug)));
      filterRow.appendChild(b);
    }
    syncChips();
  }

  function syncChips() {
    filterRow.querySelectorAll('.chip').forEach((chip) => {
      const key = chip.dataset.filter;
      const on = key === 'all' ? active.size === 0 : active.has(key);
      chip.setAttribute('aria-pressed', String(on));
    });
    sortRow.querySelectorAll('.chip').forEach((chip) => {
      chip.setAttribute('aria-pressed', String(chip.dataset.sort === sort));
    });
  }

  filterRow.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const key = chip.dataset.filter;
    if (key === 'all') active.clear();
    else if (active.has(key)) active.delete(key);
    else active.add(key);
    syncChips();
    apply(true);
  });

  sortRow.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip || chip.dataset.sort === sort) return;
    sort = chip.dataset.sort;
    syncChips();
    apply(true);
  });

  /* ---- kacheln bauen ---------------------------------------------------- */
  function mediaNode(cover) {
    const box = document.createElement('div');
    box.className = 'tile-media';

    if (cover.kind === 'youtube') {
      // im raster nur das vorschaubild — der player laedt erst auf der
      // detailseite, und auch dort erst nach einem klick
      const img = document.createElement('img');
      img.src = `https://i.ytimg.com/vi/${cover.src}/hqdefault.jpg`;
      img.alt = cover.alt || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      box.appendChild(img);
    } else if (cover.kind === 'video') {
      const v = document.createElement('video');
      /* preload MUSS vor src stehen, sonst greift es nicht mehr.
         und es bleibt bei 'none': mit 'metadata' holt der browser bei einem
         mp4, dessen moov-atom am ende liegt, fast die ganze datei — bei
         videos von 40 bis 110 MB waeren das hunderte megabyte, nur fuer
         vier standbilder. das standbild kommt deshalb aus poster, das
         erzeugt der server beim upload (server/lib/poster.js). */
      v.preload = 'none';
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      if (cover.poster) v.poster = cover.poster;
      v.src = cover.src;
      box.appendChild(v);
    } else {
      const img = document.createElement('img');
      // kleine fassung, wenn es eine gibt — das original kann 46 MB haben
      img.src = cover.thumb || cover.src;
      img.alt = cover.alt || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      box.appendChild(img);
    }
    return box;
  }

  /* wellenform einer audiodatei, wie man sie von soundcloud kennt. beim
     ueberfahren zeigt eine linie, wo im stueck man gerade ist; der link
     bekommt die stelle als ?t= angehaengt, sodass ein klick die detailseite
     genau dort startet. der link wird dabei nur umgeschrieben, nicht
     abgefangen — mittelklick und tastatur funktionieren dadurch weiter. */
  function waveNode(post, media, link) {
    const box = document.createElement('div');
    box.className = 'tile-media tile-wave';

    const canvas = document.createElement('canvas');
    canvas.className = 'wave-canvas';
    box.appendChild(canvas);

    const time = document.createElement('span');
    time.className = 'wave-time';
    box.appendChild(time);

    const base = `/portfolio/${post.slug}`;
    let wave = null;
    let hover = null;

    const paint = () => {
      if (!wave) return;
      window.__viz.fit(canvas);
      window.__viz.drawWaveform(canvas, wave, { hover });
    };

    window.__viz.loadWaveform(media.waveform)
      .then((loaded) => { wave = loaded; paint(); })
      .catch(() => { box.classList.add('wave-failed'); });

    box.addEventListener('pointermove', (e) => {
      if (!wave) return;
      const rect = box.getBoundingClientRect();
      hover = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const at = hover * wave.duration;
      box.classList.add('seeking');
      time.textContent = window.__viz.formatTime(at);
      link.href = `${base}?t=${at.toFixed(1)}&audio=${media.id}`;
      paint();
    });

    box.addEventListener('pointerleave', () => {
      hover = null;
      box.classList.remove('seeking');
      link.href = base;
      paint();
    });

    new ResizeObserver(paint).observe(box);
    return box;
  }

  function tileNode(post) {
    const li = document.createElement('li');
    li.className = 'tile';
    li.dataset.slug = post.slug;

    const link = document.createElement('a');
    link.className = 'tile-link';
    link.href = `/portfolio/${post.slug}`;

    // audio hat kein bild, aber eine vorberechnete wellenform
    const cover = post.cover && post.cover.kind !== 'audio' ? post.cover : null;
    const audio = (post.cover && post.cover.kind === 'audio' && post.cover.waveform)
      ? post.cover
      : post.media.find((m) => m.kind === 'audio' && m.waveform);

    if (cover) {
      link.appendChild(mediaNode(cover));
    } else if (audio) {
      link.appendChild(waveNode(post, audio, link));
    } else {
      li.classList.add('no-media');
    }

    const body = document.createElement('div');
    body.className = 'tile-body';

    // der text sitzt in einem eigenen balken mit deckender flaeche — sonst
    // steht er je nach medium auf einem gleich hellen hintergrund
    const bar = document.createElement('div');
    bar.className = 'tile-bar';

    const h2 = document.createElement('h2');
    h2.className = 'tile-title';
    h2.textContent = post.title;
    bar.appendChild(h2);

    if (post.summary) {
      const p = document.createElement('p');
      p.className = 'tile-summary';
      p.textContent = post.summary;
      bar.appendChild(p);
    }

    const meta = document.createElement('div');
    meta.className = 'tile-meta';

    // medien-marker statt icons: [image] [video] [audio] [text]
    const kinds = post.kinds.length ? post.kinds : ['text'];
    for (const kind of kinds) {
      const m = document.createElement('span');
      m.className = 'marker';
      m.textContent = kind;
      meta.appendChild(m);
    }

    if (post.categories.length) {
      const cats = document.createElement('span');
      cats.className = 'tile-cats';
      cats.textContent = post.categories.map((c) => c.name).join(' / ');
      meta.appendChild(cats);
    }

    bar.appendChild(meta);
    body.appendChild(bar);
    link.appendChild(body);
    li.appendChild(link);

    hoverBehaviour(li, link);
    return li;
  }

  // kacheln einmal bauen und behalten; einsortiert werden sie in renderRows
  function buildTiles() {
    for (const post of posts) tiles.set(post.slug, tileNode(post));
  }

  /* ---- hover: focus/dim + video anspielen -------------------------------- */
  function hoverBehaviour(li, link) {
    const enter = () => {
      grid.classList.add('mm-focusing');
      li.classList.add('mm-active');
      const v = link.querySelector('video');
      if (v && !reduceMotion) v.play().catch(() => {});
    };
    const leave = () => {
      grid.classList.remove('mm-focusing');
      li.classList.remove('mm-active');
      const v = link.querySelector('video');
      if (v) { v.pause(); v.currentTime = 0; }
    };
    li.addEventListener('pointerenter', enter);
    li.addEventListener('pointerleave', leave);
    link.addEventListener('focus', enter);
    link.addEventListener('blur', leave);
  }

  /* ---- filtern + sortieren anwenden -------------------------------------- */
  function matches(post) {
    if (!active.size) return true;
    // ODER-logik: ein post passt, wenn er mindestens eine gewaehlte kategorie hat
    return post.categories.some((c) => active.has(c.slug));
  }

  const comparators = {
    // 'arranged' sortiert nicht — die reihenfolge steckt in den zeilen
    arranged: () => 0,
    newest: (a, b) =>
      Number(b.pinned) - Number(a.pinned) || b.publishedAt.localeCompare(a.publishedAt),
    oldest: (a, b) => a.publishedAt.localeCompare(b.publishedAt),
    title:  (a, b) => a.title.localeCompare(b.title),
  };

  /* =====================================================================
     anordnung
     =====================================================================
     eine zeile teilt ihre breite unter ihren spalten auf (flex-grow nach
     gewicht), eine spalte ihre hoehe unter ihren kacheln. beides summiert
     sich immer auf das ganze — es kann also kein platz uebrig bleiben.
     eine luecke ist hier nicht darstellbar, nicht bloss unwahrscheinlich.

     das gilt auch beim filtern: faellt eine kachel weg, verteilt sich ihr
     platz auf die verbleibenden, weil die gewichte relativ sind.          */

  // wie viele spalten eine zeile hoechstens haben darf. auf schmalen
  // schirmen werden breitere zeilen in stuecke geteilt — jedes stueck ist
  // dann wieder eine volle zeile.
  function maxCellsPerRow() {
    const w = window.innerWidth;
    if (w < 460) return 1;
    if (w < 760) return 2;
    return 4;
  }

  function chunk(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
  }

  // zeilen aus einer schlichten liste bauen — fuer posts, die noch nicht
  // eingeordnet sind, und fuer jede sortierung ausser der eigenen
  function autoRows(list, perRow) {
    return chunk(list, Math.min(2, perRow)).map((group) => ({
      units: 2,
      cells: group.map((post) => ({ weight: 1, posts: [post] })),
    }));
  }

  function buildRows(visible) {
    const perRow = maxCellsPerRow();
    const visibleIds = new Set(visible.map((p) => p.id));
    const byId = new Map(posts.map((p) => [p.id, p]));

    // andere sortierungen ordnen die posts neu — dann greift die eigene
    // anordnung nicht mehr, und es wird selbsttaetig gebaut
    if (sort !== 'arranged' || !layoutData) return autoRows(visible, perRow);

    const rows = [];
    for (const row of layoutData.rows) {
      const cells = row.cells
        .map((cell) => ({
          weight: cell.weight,
          posts: cell.posts.filter((id) => visibleIds.has(id)).map((id) => byId.get(id)),
        }))
        // eine spalte ohne kachel waere genau die luecke, die es nicht geben soll
        .filter((cell) => cell.posts.length);

      if (!cells.length) continue;
      for (const part of chunk(cells, perRow)) rows.push({ units: row.units, cells: part });
    }

    // was noch nicht eingeordnet ist, haengt hinten dran
    const loose = (layoutData.loose || [])
      .map((id) => byId.get(id))
      .filter((post) => post && visibleIds.has(post.id));
    rows.push(...autoRows(loose, perRow));
    return rows;
  }

  function renderRows(visible) {
    const frag = document.createDocumentFragment();

    for (const row of buildRows(visible)) {
      const rowEl = document.createElement('div');
      rowEl.className = 'grid-row';
      rowEl.style.setProperty('--units', row.units);

      for (const cell of row.cells) {
        const cellEl = document.createElement('div');
        cellEl.className = 'grid-cell';
        cellEl.style.setProperty('--weight', cell.weight);
        for (const post of cell.posts) cellEl.appendChild(tiles.get(post.slug));
        rowEl.appendChild(cellEl);
      }
      frag.appendChild(rowEl);
    }

    grid.replaceChildren(frag);
  }

  let shown = [];

  function apply(animate) {
    const run = () => {
      const visible = posts.filter(matches).sort(comparators[sort] || (() => 0));
      shown = visible;

      renderRows(visible);

      emptyEl.hidden = visible.length > 0;
      statusEl.textContent =
        visible.length === posts.length
          ? `${posts.length} pieces`
          : `${visible.length} of ${posts.length} pieces`;

      writeUrl();
      grid.classList.remove('reflowing');
    };

    if (animate && FADE) {
      grid.classList.add('reflowing');
      setTimeout(run, FADE);
    } else {
      run();
    }
  }

  // wie viele spalten eine zeile vertraegt, haengt an der fensterbreite
  let resizeTimer;
  let lastPerRow = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const perRow = maxCellsPerRow();
      if (perRow === lastPerRow) return;
      lastPerRow = perRow;
      renderRows(shown);
    }, 150);
  });

  load();
})();
