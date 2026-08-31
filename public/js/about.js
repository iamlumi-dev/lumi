/*=== ABOUT — reiter, die den mittelteil austauschen ===*/
(function () {
  const tabsEl = document.getElementById('tabs');
  const contentEl = document.getElementById('content');

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

  /* ---- layout "prose": leerzeilen trennen absaetze ----------------------- */
  function renderProse(page, into) {
    page.body.split(/\n\s*\n/).filter((s) => s.trim())
      .forEach((chunk) => into.appendChild(el('p', 'lead', chunk.trim())));
  }

  /* ---- layout "list": gruppen und beschriftete zeilen -------------------- */
  // "software:"      -> eroeffnet eine gruppe
  // "mixing: hd 560s" -> beschriftete zeile in der laufenden gruppe
  // alles andere      -> schlichter eintrag
  function parseList(body) {
    const groups = [];
    let group = null;
    const open = (title) => { group = { title, rows: [] }; groups.push(group); return group; };

    for (const raw of body.split('\n')) {
      const line = raw.trim();
      if (!line) continue;

      const heading = /^(.+?):$/.exec(line);
      if (heading) { open(heading[1]); continue; }

      if (!group) open(null);

      const pair = /^(.+?):\s+(.+)$/.exec(line);
      if (pair) group.rows.push({ key: pair[1], value: pair[2] });
      else group.rows.push({ value: line });
    }
    return groups;
  }

  function renderList(page, into) {
    const wrap = el('div', 'list-groups');

    for (const group of parseList(page.body)) {
      const section = el('section', 'list-group');
      if (group.title) section.appendChild(el('h2', 'list-head', group.title));

      const dl = el('dl', 'list-pairs');
      for (const row of group.rows) {
        const line = el('div', 'list-pair');
        // ohne schluessel bleibt die erste spalte leer, damit die
        // werte-spalte ueber alle zeilen hinweg buendig bleibt
        line.appendChild(el('dt', null, row.key ?? ''));
        line.appendChild(el('dd', null, row.value));
        dl.appendChild(line);
      }
      section.appendChild(dl);
      wrap.appendChild(section);
    }
    into.appendChild(wrap);
  }

  /* ---- layout "links": optionaler text, danach die eintraege -------------- */
  function renderLinks(page, into) {
    if (page.body.trim()) renderProse(page, into);

    if (!page.links.length) {
      into.appendChild(el('p', 'lead empty', 'coming soon …'));
      return;
    }

    const row = el('div', 'link-row');
    for (const link of page.links) {
      const a = el('a', null, link.label);

      if (link.mail) {
        // die adresse steht nirgends am stueck — weder im markup noch in der
        // api-antwort. sie wird erst gebaut, wenn jemand hinfasst.
        const build = () => `mailto:${link.mail.user}@${link.mail.domain}`;
        a.href = '#';
        const arm = () => { a.href = build(); };
        a.addEventListener('pointerenter', arm);
        a.addEventListener('focus', arm);
        a.addEventListener('click', (e) => { e.preventDefault(); location.href = build(); });
      } else {
        a.href = link.url;
        if (/^https?:/i.test(link.url)) {
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
        }
      }
      row.appendChild(a);
    }
    into.appendChild(row);
  }

  const LAYOUTS = { prose: renderProse, list: renderList, links: renderLinks };
  const paintInto = (page, into) => (LAYOUTS[page.layout] || renderProse)(page, into);

  /* ---- hoehe einfrieren --------------------------------------------------- */
  // alle reiter einmal durchmessen und die groesste hoehe festhalten. sonst
  // springt die zentrierte spalte beim umschalten, und genau das soll sie
  // nicht — die seite ist ein viewport und soll ruhig bleiben.
  function lockHeight() {
    contentEl.style.minHeight = '0px';
    let max = 0;
    for (const page of pages) {
      contentEl.replaceChildren();
      paintInto(page, contentEl);
      max = Math.max(max, contentEl.scrollHeight);
    }
    contentEl.replaceChildren();
    contentEl.style.minHeight = `${max}px`;
  }

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
      contentEl.replaceChildren();
      paintInto(page, contentEl);
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

      // erst messen, wenn die schriften stehen — sonst misst man den fallback
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      lockHeight();
      show(indexFromHash(), { animate: false, push: false });

      window.addEventListener('hashchange', () => show(indexFromHash(), { push: false }));

      // beim resize aendert sich die spaltenzahl der setup-liste → neu messen
      let t;
      window.addEventListener('resize', () => {
        clearTimeout(t);
        t = setTimeout(() => { lockHeight(); show(current, { animate: false, push: false }); }, 200);
      });
    } catch (err) {
      contentEl.replaceChildren(el('p', 'lead', 'could not load this page … try reloading'));
      console.error(err);
    }
  }

  load();
})();
