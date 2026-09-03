/*=== SPLASH — die zeile unter dem titel ===*/
// alle aktiven werden einmal geholt; das nachwuerfeln beim klick kostet
// danach keine anfrage mehr.
(function () {
  const el = document.getElementById('splash');
  if (!el) return;
  const wrapEl = el.closest('.splash-wrap');

  let pool = [];
  let last = el.textContent.trim();

  function applySplash(item) {
    if (!item) return;
    const text = typeof item === 'string' ? item : item.text;
    const wrap = typeof item === 'string' ? true : (item.wrap !== false);
    last = text;
    el.textContent = text;
    if (wrap) {
      el.classList.remove('nowrap');
      wrapEl?.classList.remove('nowrap');
    } else {
      el.classList.add('nowrap');
      wrapEl?.classList.add('nowrap');
    }
  }

  function roll() {
    if (!pool.length) return;
    if (pool.length === 1) {
      applySplash(pool[0]);
      return;
    }
    let next;
    // nicht zweimal hintereinander dieselbe
    do {
      next = pool[Math.floor(Math.random() * pool.length)];
    } while ((typeof next === 'string' ? next : next.text) === last);
    applySplash(next);
  }

  el.addEventListener('click', roll);

  fetch('/api/splashes')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data?.splashes?.length) return;
      pool = data.splashes;
      roll();
    })
    .catch(() => { /* dann bleibt die zeile aus dem html stehen */ });

  // das terminal darf sich auch eine ziehen
  window.__splash = {
    roll,
    all: () => pool.map((s) => (typeof s === 'string' ? s : s.text)),
  };
})();
