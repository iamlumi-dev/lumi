/*=== SITE — laeuft auf jeder seite ===*/

// --- hintergrund-sketch nachladen ------------------------------------------
(function loadBackground() {
  if (!document.getElementById('p5-bg-container')) return;
  // wer reduzierte bewegung eingestellt hat, bekommt keinen animierten canvas
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // der roots-sketch ist fuers erste stillgelegt — die datei liegt weiter
  // unter /js/roots.js, zum reaktivieren einfach wieder in die liste aufnehmen.
  const scripts = ['/js/wheat.js'];
  const chosen = scripts[Math.floor(Math.random() * scripts.length)];
  const tag = document.createElement('script');
  tag.src = chosen;
  tag.defer = true;
  document.body.appendChild(tag);
})();
