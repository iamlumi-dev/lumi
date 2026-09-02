/*=== AUDIO-DARSTELLUNG ===*/
/* die wellenform einer audiodatei, gezeichnet aus vorberechneten daten.
   sie erscheint zweimal: als kachel im portfolio und als abspielbalken auf
   der detailseite.                                                        */
window.__viz = (function () {
  /* ---- wellenform ----------------------------------------------------------
     wie man sie von soundcloud kennt: balken, an der mittellinie
     gespiegelt. dieselben daten tragen die kachel im portfolio und den
     abspielbalken auf der detailseite. die farben kommen ueber custom
     properties herein, damit beide stellen dieselbe routine benutzen.   */

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{buckets:number, bytes:Uint8Array}} wave
   * @param {{progress?:number, hover?:number}} [state]
   *   anteile von 0 bis 1. was abgespielt ist, steht heller da; die stelle
   *   unter dem zeiger bekommt eine linie.
   */
  function drawWaveform(canvas, wave, state = {}) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const mid = h / 2;
    const bytes = wave.bytes;

    const style = getComputedStyle(canvas);
    const played = style.getPropertyValue('--wave-played').trim() || '#B5E19E';
    const rest = style.getPropertyValue('--wave-rest').trim() || '#36611E';
    const head = style.getPropertyValue('--wave-head').trim() || '#cce3c3';

    ctx.clearRect(0, 0, w, h);

    // balkenbreite so waehlen, dass immer eine luecke bleibt
    const step = Math.max(2, Math.round(w / 180));
    const bar = Math.max(1, step - 1);
    const count = Math.floor(w / step);
    const upto = (state.progress ?? 0) * count;

    for (let i = 0; i < count; i++) {
      // mehrere datenpunkte je balken zusammenfassen
      const from = Math.floor((i / count) * wave.buckets);
      const to = Math.max(from + 1, Math.floor(((i + 1) / count) * wave.buckets));
      let peak = 0;
      for (let k = from; k < to; k++) if (bytes[k] > peak) peak = bytes[k];

      // nie ganz null: eine stille stelle bleibt als linie sichtbar
      const amp = Math.max(1.5, (peak / 255) * (mid - 2));
      ctx.fillStyle = i < upto ? played : rest;
      ctx.fillRect(i * step, mid - amp, bar, amp * 2);
    }

    if (state.hover !== undefined && state.hover !== null) {
      ctx.fillStyle = head;
      ctx.fillRect(Math.round(state.hover * w), 0, 1.5, h);
    }
  }

  /* ---- partikel ------------------------------------------------------------
     ein feld aus punkten, das auf die musik reagiert. bewusst dieselbe
     sprache wie der hintergrund der seite: dort steht ein punktraster im
     wind, hier wird eines von der musik geschoben.

     jeder punkt hat einen ruheplatz und ein frequenzband. die energie in
     seinem band druckt ihn nach aussen und laesst ihn heller werden; eine
     feder zieht ihn zurueck. ein bass-anschlag stoesst das ganze feld kurz
     auseinander.                                                          */

  function particles(canvas, count = 260) {
    const ctx = canvas.getContext('2d');
    const dots = [];
    let bassAvg = 0;
    let pulse = 0;
    let seeded = 0;

    function seed(w, h) {
      dots.length = 0;
      const unit = Math.min(w, h);
      for (let i = 0; i < count; i++) {
        // gleichmaessig auf einer scheibe verteilen, nicht in der mitte
        // gehaeuft — deshalb die wurzel
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * unit * 0.46;
        dots.push({
          hx: w / 2 + Math.cos(a) * r,     // ruheplatz
          hy: h / 2 + Math.sin(a) * r,
          x: w / 2 + Math.cos(a) * r,
          y: h / 2 + Math.sin(a) * r,
          vx: 0,
          vy: 0,
          // band aus dem abstand zur mitte: tiefe toene innen, hohe aussen
          band: Math.min(0.98, r / (unit * 0.46)),
          size: 0.8 + Math.random() * 1.6,
          drift: Math.random() * Math.PI * 2,
        });
      }
      seeded = w * 31 + h;
    }

    function draw(freq, level) {
      const w = canvas.width;
      const h = canvas.height;
      if (seeded !== w * 31 + h) seed(w, h);

      const cx = w / 2;
      const cy = h / 2;
      const unit = Math.min(w, h);

      // bass getrennt beobachten: ein anschlag ist ein sprung darin
      let bass = 0;
      const bassBins = Math.max(1, Math.floor(freq.length * 0.06));
      for (let i = 0; i < bassBins; i++) bass += freq[i];
      bass = bass / bassBins / 255;
      if (bass > bassAvg * 1.25 + 0.06) pulse = Math.min(1, pulse + 0.55);
      bassAvg += (bass - bassAvg) * 0.12;
      pulse *= 0.90;

      ctx.clearRect(0, 0, w, h);

      for (const d of dots) {
        // energie im band dieses punktes, nur bis 65% der baender —
        // darueber ist bei mp3 nichts mehr
        const bin = Math.floor((freq.length - 1) * 0.65 * (d.band ** 1.6));
        const energy = (freq[bin] || 0) / 255;

        // nach aussen druecken: eigenes band plus der gemeinsame stoss
        const dx = d.x - cx;
        const dy = d.y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const push = (energy * 0.9 + pulse * 1.4) * unit * 0.0016;
        d.vx += (dx / dist) * push;
        d.vy += (dy / dist) * push;

        // feder zurueck zum ruheplatz, plus reibung
        d.vx += (d.hx - d.x) * 0.012;
        d.vy += (d.hy - d.y) * 0.012;
        d.vx *= 0.90;
        d.vy *= 0.90;

        // leichtes eigenleben, damit es auch bei stille nicht erstarrt
        d.drift += 0.01;
        d.x += d.vx + Math.cos(d.drift) * 0.12;
        d.y += d.vy + Math.sin(d.drift * 0.8) * 0.12;

        const bright = Math.min(1, 0.18 + energy * 0.9 + pulse * 0.4);
        const size = d.size * (1 + energy * 1.1 + pulse * 0.5);

        ctx.beginPath();
        ctx.arc(d.x, d.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(168, 179, 135, ${bright})`;
        ctx.fill();
      }

      // ein ruhiger kreis in der mitte, der mit der lautstaerke atmet
      ctx.beginPath();
      ctx.arc(cx, cy, unit * (0.05 + level * 0.05 + pulse * 0.02), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(108, 194, 61, ${0.25 + level * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    return { draw };
  }

  /* ---- hilfen -------------------------------------------------------------- */

  /** canvas auf seine angezeigte groesse bringen, scharf auf allen schirmen */
  function fit(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      return true;
    }
    return false;
  }

  /** wellenform laden und die base64-daten auspacken */
  async function loadWaveform(src) {
    const res = await fetch(src);
    if (!res.ok) throw new Error('wellenform nicht ladbar');
    const wave = await res.json();
    const raw = atob(wave.peaks);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return { ...wave, bytes };
  }

  const formatTime = (secs) => {
    if (!isFinite(secs) || secs < 0) return '–:––';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return { drawWaveform, particles, fit, loadWaveform, formatTime };
})();
