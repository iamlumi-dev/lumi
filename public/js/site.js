/*=== SITE — laeuft auf jeder seite ===*/

// --- hintergrund-sketch ------------------------------------------------------
// welcher laeuft, steht im localStorage und ist ueber den terminal-befehl
// "theme" umschaltbar. ohne eintrag: wheat.
window.__bg = (function () {
  const KEY = 'lw.theme';
  const SKETCHES = { wheat: '/js/wheat.js', roots: '/js/roots.js' };
  const DEFAULT = 'wheat';

  const container = document.getElementById('p5-bg-container');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function stored() {
    try {
      const value = localStorage.getItem(KEY);
      return value && (value === 'off' || SKETCHES[value]) ? value : DEFAULT;
    } catch {
      return DEFAULT;      // privater modus
    }
  }

  const api = {
    available: ['wheat', 'roots', 'off'],
    current: stored(),

    set(name) {
      if (!api.available.includes(name)) return false;
      api.current = name;
      try { localStorage.setItem(KEY, name); } catch { /* dann nur fuer diesen besuch */ }
      api.load();
      return true;
    },

    load() {
      if (!container) return;

      // laufende instanz abraeumen. jeder sketch legt sich unter
      // window.__bgInstance ab, damit er hier entfernt werden kann.
      if (window.__bgInstance) {
        try { window.__bgInstance.remove(); } catch { /* egal */ }
        window.__bgInstance = null;
      }
      container.replaceChildren();
      document.querySelectorAll('script[data-bg]').forEach((s) => s.remove());

      // wer reduzierte bewegung eingestellt hat, bekommt keinen animierten canvas
      if (api.current === 'off' || reduceMotion) return;

      const tag = document.createElement('script');
      tag.src = SKETCHES[api.current];
      tag.dataset.bg = api.current;
      document.body.appendChild(tag);
    },
  };

  return api;
})();

window.__bg.load();
