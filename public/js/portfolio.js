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
  let sort = 'newest';
  const tiles = new Map();         // slug -> <li>

  /* ---- daten holen ------------------------------------------------------ */
  async function load() {
    try {
      const [postsRes, catsRes] = await Promise.all([
        fetch('/api/posts'),
        fetch('/api/categories'),
      ]);
      if (!postsRes.ok || !catsRes.ok) throw new Error('api');

      posts = (await postsRes.json()).posts;
      const categories = (await catsRes.json()).categories;

      readUrl(categories);
      renderFilters(categories);
      renderTiles();
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
    if (['newest', 'oldest', 'title'].includes(s)) sort = s;
  }

  function writeUrl() {
    const params = new URLSearchParams();
    if (active.size) params.set('c', [...active].join(','));
    if (sort !== 'newest') params.set('sort', sort);
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

    if (cover.kind === 'video') {
      const v = document.createElement('video');
      v.src = cover.src;
      if (cover.poster) v.poster = cover.poster;
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = 'none';
      box.appendChild(v);
    } else {
      const img = document.createElement('img');
      img.src = cover.src;
      img.alt = cover.alt || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      box.appendChild(img);
    }
    return box;
  }

  function tileNode(post) {
    const li = document.createElement('li');
    li.className = `tile size-${post.size}`;
    li.dataset.slug = post.slug;

    const link = document.createElement('a');
    link.className = 'tile-link';
    link.href = `/portfolio/${post.slug}`;

    // cover nur, wenn es ein sichtbares medium gibt — audio hat kein bild
    const cover = post.cover && post.cover.kind !== 'audio' ? post.cover : null;
    if (cover) link.appendChild(mediaNode(cover));
    else li.classList.add('no-media');

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

  function renderTiles() {
    const frag = document.createDocumentFragment();
    for (const post of posts) {
      const node = tileNode(post);
      tiles.set(post.slug, node);
      frag.appendChild(node);
    }
    grid.appendChild(frag);
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
    newest: (a, b) =>
      Number(b.pinned) - Number(a.pinned) || b.publishedAt.localeCompare(a.publishedAt),
    oldest: (a, b) => a.publishedAt.localeCompare(b.publishedAt),
    title:  (a, b) => a.title.localeCompare(b.title),
  };

  function apply(animate) {
    const run = () => {
      const visible = posts.filter(matches).sort(comparators[sort]);

      // reihenfolge im dom setzen — grid-auto-flow: dense packt dann selbst
      for (const post of visible) grid.appendChild(tiles.get(post.slug));

      const shown = new Set(visible.map((p) => p.slug));
      for (const [slug, node] of tiles) node.classList.toggle('hidden', !shown.has(slug));

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

  load();
})();
