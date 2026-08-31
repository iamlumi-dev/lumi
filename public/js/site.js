/*=== SITE — laeuft auf jeder seite ===*/

// --- zufaelligen hintergrund-sketch nachladen ------------------------------
// die seite sieht bei jedem besuch anders aus.
(function loadBackground() {
  if (!document.getElementById('p5-bg-container')) return;
  // wer reduzierte bewegung eingestellt hat, bekommt keinen animierten canvas
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const scripts = ['/js/roots.js', '/js/wheat.js'];
  const chosen = scripts[Math.floor(Math.random() * scripts.length)];
  const tag = document.createElement('script');
  tag.src = chosen;
  tag.defer = true;
  document.body.appendChild(tag);
})();

// --- sample & hold ---------------------------------------------------------
// schreibt alle 115 ms eine neue zufallszahl in --sh-value. gehoverte buttons
// benutzen sie als scale und zittern dadurch unregelmaessig.
(function startSampleAndHold(min, max, holdTime) {
  const root = document.documentElement;
  function sample() {
    const value = Math.random() * (max - min) + min;
    root.style.setProperty('--sh-value', value.toFixed(3));
    setTimeout(sample, holdTime);
  }
  sample();
})(1.05, 1.25, 115);
