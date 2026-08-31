/*=== SHOUTOUTS — empfehlungen ===*/
(function () {
  const list = document.getElementById('shouts');
  const filterRow = document.getElementById('filterRow');
  const statusEl = document.getElementById('status');
  const emptyEl = document.getElementById('empty');
  const introEl = document.getElementById('intro');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FADE = reduceMotion ? 0 : 300;

  let shoutouts = [];
  let active = new Set();

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  /* ---- eine zeile --------------------------------------------------------- */

  function row(shout) {
    const li = el('li', 'shout');
    li.dataset.kind = shout.kind;

    // mit adresse ist die ganze zeile ein link, ohne bleibt sie ein block
    const box = el(shout.url ? 'a' : 'div', 'shout-link');
    if (shout.url) {
      box.href = shout.url;
      box.target = '_blank';
      box.rel = 'noopener noreferrer';
    }

    if (shout.cover) {
      const img = el('img', 'shout-cover');
      img.src = shout.cover;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      box.appendChild(img);
    } else {
      box.appendChild(el('div', 'shout-cover shout-cover-empty', shout.kind));
    }

    const main = el('div', 'shout-main');

    const head = el('div', 'shout-head');
    head.appendChild(el('span', 'shout-creator', shout.creator));
    if (shout.title) {
      head.appendChild(el('span', 'shout-dash', ' — '));
      head.appendChild(el('span', 'shout-title', shout.title));
    }
    main.appendChild(head);

    if (shout.note) main.appendChild(el('p', 'shout-note', shout.note));

    const meta = el('div', 'shout-meta');
    meta.appendChild(el('span', 'marker', shout.kind));
    meta.appendChild(el('span', 'shout-date', shout.date));
    if (shout.url) meta.appendChild(el('span', 'shout-go', 'listen ↗'));
    main.appendChild(meta);

    box.appendChild(main);
    li.appendChild(box);
    return li;
  }

  /* ---- filter ------------------------------------------------------------- */

  function renderFilters(kinds) {
    // bei nur einer art braucht es keine leiste
    if (kinds.length < 2) return;
    filterRow.hidden = false;
    for (const k of kinds) {
      const b = el('button', 'chip', `${k.kind} (${k.count})`);
      b.type = 'button';
      b.dataset.filter = k.kind;
      filterRow.appendChild(b);
    }
    syncChips();
  }

  function syncChips() {
    filterRow.querySelectorAll('.chip').forEach((chip) => {
      const key = chip.dataset.filter;
      chip.setAttribute('aria-pressed', String(key === 'all' ? active.size === 0 : active.has(key)));
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

  function writeUrl() {
    const params = new URLSearchParams();
    if (active.size) params.set('k', [...active].join(','));
    const qs = params.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }

  function apply(animate) {
    const run = () => {
      let visible = 0;
      for (const li of list.children) {
        const show = !active.size || active.has(li.dataset.kind);
        li.classList.toggle('hidden', !show);
        if (show) visible++;
      }
      emptyEl.hidden = visible > 0;
      statusEl.textContent = visible === shoutouts.length
        ? `${shoutouts.length} shoutouts`
        : `${visible} of ${shoutouts.length} shoutouts`;
      writeUrl();
      list.classList.remove('reflowing');
    };

    if (animate && FADE) {
      list.classList.add('reflowing');
      setTimeout(run, FADE);
    } else {
      run();
    }
  }

  /* ---- laden -------------------------------------------------------------- */

  async function load() {
    try {
      const [shoutRes, introRes] = await Promise.all([
        fetch('/api/shoutouts'),
        fetch('/api/pages/shoutouts').catch(() => null),
      ]);
      if (!shoutRes.ok) throw new Error('api');

      const data = await shoutRes.json();
      shoutouts = data.shoutouts;

      // einleitungszeile ist optional
      if (introRes?.ok) {
        const page = (await introRes.json()).page;
        if (page?.body.trim()) introEl.textContent = page.body.trim();
      }

      if (!shoutouts.length) {
        statusEl.textContent = '';
        emptyEl.hidden = false;
        return;
      }

      list.replaceChildren(...shoutouts.map(row));
      renderFilters(data.kinds);

      // filter aus der url, damit die auswahl teilbar ist
      const known = new Set(data.kinds.map((k) => k.kind));
      (new URLSearchParams(location.search).get('k') || '')
        .split(',').map((s) => s.trim()).filter((s) => known.has(s))
        .forEach((s) => active.add(s));
      syncChips();

      apply(false);
    } catch (err) {
      statusEl.textContent = 'could not load the shoutouts … try reloading';
      console.error(err);
    }
  }

  load();
})();
