/*=== ABOUT — reiter, die den mittelteil austauschen ===*/
(function () {
  const tabsEl = document.getElementById('tabs');
  const contentEl = document.getElementById('content');
  const titleEl = document.getElementById('pageTitle');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FADE = reduceMotion ? 0 : 300;

  let pages = [];
  let current = 0;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  /* ---- die drei layouts -------------------------------------------------- */
  // prose: leerzeilen trennen absaetze
  function renderProse(page, into) {
    page.body.split(/\n\s*\n/).filter((s) => s.trim())
      .forEach((chunk) => into.appendChild(el('p', 'lead', chunk.trim())));
  }

  // list: jede zeile ein eintrag
  function renderList(page, into) {
    const ul = el('ul', 'plain-list');
    page.body.split('\n').map((s) => s.trim()).filter(Boolean)
      .forEach((line) => ul.appendChild(el('li', null, line)));
    into.appendChild(ul);
  }

  // links: optionaler einleitungstext, danach die eintraege aus der db
  function renderLinks(page, into) {
    if (page.body.trim()) renderProse(page, into);
    const row = el('div', 'link-row');
    for (const link of page.links) {
      const a = el('a', null, link.label);
      a.href = link.url;
      // externe ziele in neuem tab, mailto: und interne nicht
      if (/^https?:/i.test(link.url)) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      row.appendChild(a);
    }
    into.appendChild(row);
  }

  const LAYOUTS = { prose: renderProse, list: renderList, links: renderLinks };

  /* ---- umschalten -------------------------------------------------------- */
  function show(index, { animate = true, push = true } = {}) {
    const page = pages[index];
    if (!page) return;
    current = index;

    tabsEl.querySelectorAll('.chip').forEach((chip, i) => {
      chip.setAttribute('aria-selected', String(i === index));
      chip.setAttribute('aria-pressed', String(i === index));
      chip.tabIndex = i === index ? 0 : -1;
    });

    const paint = () => {
      titleEl.textContent = page.title;
      document.title = `${page.title} ✧ lumis work`;
      contentEl.replaceChildren();
      (LAYOUTS[page.layout] || renderProse)(page, contentEl);
      contentEl.classList.remove('fading');
    };

    if (animate && FADE) {
      contentEl.classList.add('fading');
      setTimeout(paint, FADE);
    } else {
      paint();
    }

    // der erste reiter ist die nackte /about/-url, die anderen bekommen einen hash
    if (push) {
      const hash = index === 0 ? '' : `#${page.slug.replace(/^about-/, '')}`;
      history.replaceState(null, '', hash || location.pathname);
    }
  }

  function indexFromHash() {
    const hash = location.hash.slice(1);
    if (!hash) return 0;
    const i = pages.findIndex((p) => p.slug.replace(/^about-/, '') === hash);
    return i === -1 ? 0 : i;
  }

  /* ---- reiter bauen ------------------------------------------------------ */
  function renderTabs() {
    tabsEl.replaceChildren();
    pages.forEach((page, i) => {
      const b = el('button', 'chip', page.title);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => show(i));
      tabsEl.appendChild(b);
    });

    // pfeiltasten wechseln den reiter, wie bei einer tablist ueblich
    tabsEl.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next = (current + (e.key === 'ArrowRight' ? 1 : -1) + pages.length) % pages.length;
      show(next);
      tabsEl.querySelectorAll('.chip')[next].focus();
    });
  }

  /* ---- laden ------------------------------------------------------------- */
  async function load() {
    try {
      const res = await fetch('/api/pages/group/about');
      if (!res.ok) throw new Error('api');
      pages = (await res.json()).pages;
      if (!pages.length) throw new Error('leer');

      renderTabs();
      show(indexFromHash(), { animate: false, push: false });
      window.addEventListener('hashchange', () => show(indexFromHash(), { push: false }));
    } catch (err) {
      contentEl.replaceChildren(el('p', 'lead', 'could not load this page … try reloading'));
      console.error(err);
    }
  }

  load();
})();
