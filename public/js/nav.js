/*=== NAVIGATION ===*/
/* die menuepunkte stehen nicht mehr im html, sondern kommen aus der datenbank.
   welche seite auftaucht und an welcher stelle, steuert das feld "position"
   im editor — 0 heisst: nicht anzeigen. */
(function () {
  const targets = document.querySelectorAll('[data-nav]');
  if (!targets.length) return;

  const here = location.pathname.replace(/index\.html$/, '');

  function button(label, href) {
    const a = document.createElement('a');
    a.href = href;
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    a.appendChild(b);
    return a;
  }

  function fill(entries) {
    for (const target of targets) {
      const frag = document.createDocumentFragment();

      // "home" steht immer vorn, ausser man ist schon dort
      if (here !== '/') frag.appendChild(button('home', '/'));

      for (const item of entries) {
        // die seite, auf der man gerade steht, nicht nochmal verlinken.
        // detailseiten unter /portfolio/… zaehlen als portfolio.
        if (here === item.href) continue;
        if (item.href === '/portfolio/' && here.startsWith('/portfolio/')) continue;
        frag.appendChild(button(item.label, item.href));
      }

      target.replaceChildren(frag);
    }
  }

  fetch('/api/nav')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => { if (data?.nav) fill(data.nav); })
    .catch(() => {
      // ohne api wenigstens der weg zurueck
      for (const target of targets) target.replaceChildren(button('home', '/'));
    });
})();
