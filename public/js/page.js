/*=== TEXTSEITE ===*/
/* eine seite, deren inhalt komplett aus der tabelle "pages" kommt. welcher
   eintrag, steht in data-page am body. damit braucht eine neue textseite nur
   eine huelle mit dem richtigen slug — kein eigenes script mehr. */
(function () {
  const wrap = document.getElementById('pageBody');
  const titleEl = document.getElementById('pageTitle');
  if (!wrap) return;

  const slug = document.body.dataset.page;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  /* ---- prosa: leerzeilen trennen absaetze, "## " ist eine ueberschrift ---- */
  function renderProse(page, into) {
    for (const raw of page.body.split(/\n\s*\n/)) {
      const chunk = raw.trim();
      if (!chunk) continue;
      if (chunk.startsWith('## ')) {
        into.appendChild(el('h2', 'page-head', chunk.slice(3).trim()));
      } else {
        into.appendChild(el('p', null, chunk));
      }
    }
  }

  /* ---- liste: eine zeile ein eintrag ------------------------------------- */
  function renderList(page, into) {
    const ul = el('ul', 'plain-list');
    page.body.split('\n').map((s) => s.trim()).filter(Boolean)
      .forEach((line) => ul.appendChild(el('li', null, line)));
    into.appendChild(ul);
  }

  /* ---- links: einleitungstext, danach die eintraege ---------------------- */
  function renderLinks(page, into) {
    if (page.body.trim()) renderProse(page, into);

    if (!page.links.length) {
      into.appendChild(el('p', 'dim-line', 'coming soon …'));
      return;
    }

    const list = el('ul', 'link-list');
    for (const link of page.links) {
      const li = el('li', 'link-item');
      const a = el('a', 'link-label', link.label);

      if (link.mail) {
        // adresse wird erst beim hinfassen zusammengesetzt, siehe about-seite
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

      li.appendChild(a);
      if (link.note) li.appendChild(el('span', 'link-note', link.note));
      list.appendChild(li);
    }
    into.appendChild(list);
  }

  const LAYOUTS = { prose: renderProse, list: renderList, links: renderLinks };

  async function load() {
    try {
      const res = await fetch(`/api/pages/${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error('api');
      const page = (await res.json()).page;

      if (titleEl && page.title) titleEl.textContent = page.title;
      wrap.replaceChildren();
      (LAYOUTS[page.layout] || renderProse)(page, wrap);
    } catch (err) {
      wrap.replaceChildren(el('p', 'dim-line', 'could not load this page … try reloading'));
      console.error(err);
    }
  }

  load();
})();
