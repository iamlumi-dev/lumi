/*=== SPLASH — die zeile unter dem titel ===*/
// alle aktiven werden einmal geholt; das nachwuerfeln beim klick kostet
// danach keine anfrage mehr.
(function () {
  const el = document.getElementById('splash');
  if (!el) return;

  let pool = [];
  let last = el.textContent.trim();

  function roll() {
    if (pool.length < 2) return;
    let next;
    // nicht zweimal hintereinander dieselbe
    do { next = pool[Math.floor(Math.random() * pool.length)]; } while (next === last);
    last = next;
    el.textContent = next;
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
  window.__splash = { roll, all: () => pool };
})();
