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
     feder zieht ihn zurueck. ein bass-anschlag stoesst das feld auseinander.

     das aussehen kommt aus den einstellungen (im editor unter "visualizer"),
     gilt fuer die ganze seite und laesst sich zur laufzeit aendern.       */

  const VIZ_DEFAULTS = {
    count: 260, smoothing: 0.45, reach: 1, spring: 1, pulse: 1, drive: 1,
    connect: false, trails: false, pump: true, tint: true,
  };

  /* die fuenf farben der seite, von dunkel nach hell. tiefe toene bekommen
     die dunkleren, hohe die helleren — so sieht man, welcher punkt fuer
     welchen bereich zustaendig ist, ohne die palette zu verlassen. */
  const TONES = [
    [54, 97, 30],      // --altbgclr
    [108, 194, 61],    // --acntclr
    [168, 179, 135],   // die farbe des hintergrund-sketches
    [181, 225, 158],   // --titleclr
    [204, 227, 195],   // --txtclr
  ];

  function toneFor(t) {
    const at = t * (TONES.length - 1);
    const a = Math.floor(at);
    const b = Math.min(TONES.length - 1, a + 1);
    const f = at - a;
    return [
      Math.round(TONES[a][0] + (TONES[b][0] - TONES[a][0]) * f),
      Math.round(TONES[a][1] + (TONES[b][1] - TONES[a][1]) * f),
      Math.round(TONES[a][2] + (TONES[b][2] - TONES[a][2]) * f),
    ];
  }

  function particles(canvas, options = {}) {
    const ctx = canvas.getContext('2d');
    let opt = { ...VIZ_DEFAULTS, ...options };
    let dots = [];
    let bassAvg = 0;
    let pulse = 0;
    let hold = 0;          // dauerhafter bassanteil
    let seeded = '';

    function seed(w, h) {
      dots = [];
      const unit = Math.min(w, h);
      for (let i = 0; i < opt.count; i++) {
        // gleichmaessig auf einer scheibe verteilen, nicht in der mitte
        // gehaeuft — deshalb die wurzel
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * unit * 0.46;
        const hx = w / 2 + Math.cos(a) * r;
        const hy = h / 2 + Math.sin(a) * r;
        // band aus dem abstand zur mitte: tiefe toene innen, hohe aussen
        const band = Math.min(0.98, r / (unit * 0.46));
        dots.push({
          hx, hy, x: hx, y: hy, vx: 0, vy: 0,
          band,
          // tiefe toene sind grosse, traege punkte, hohe kleine und flinke —
          // dadurch sieht man auch ohne farbe, wer wofuer steht
          size: (2.4 - band * 1.5) * (0.75 + Math.random() * 0.5),
          tone: toneFor(band),
          drift: Math.random() * Math.PI * 2,
          e: 0,
        });
      }
      seeded = `${w}x${h}x${opt.count}`;
    }

    /* verbindungslinien: paarweise pruefen waere bei 800 punkten zu teuer.
       die punkte werden deshalb in ein grobes raster einsortiert und nur
       mit den nachbarzellen verglichen. */
    function connectDots(w, h, maxDist) {
      const cell = maxDist;
      const cols = Math.max(1, Math.ceil(w / cell));
      const rows = Math.max(1, Math.ceil(h / cell));
      const buckets = new Map();

      for (const d of dots) {
        const cx = Math.min(cols - 1, Math.max(0, Math.floor(d.x / cell)));
        const cy = Math.min(rows - 1, Math.max(0, Math.floor(d.y / cell)));
        const key = cy * cols + cx;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(d);
      }

      ctx.lineWidth = 1;
      for (const [key, list] of buckets) {
        const cx = key % cols;
        const cy = (key - cx) / cols;
        // nur nach rechts und unten schauen, sonst jedes paar zweimal
        for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 1]]) {
          const other = buckets.get((cy + oy) * cols + (cx + ox));
          if (!other) continue;
          for (const a of list) {
            for (const b of other) {
              if (a === b) continue;
              const dx = a.x - b.x;
              const dy = a.y - b.y;
              const dist = Math.hypot(dx, dy);
              if (dist > maxDist) continue;
              const near = 1 - dist / maxDist;
              ctx.strokeStyle = `rgba(108, 194, 61, ${near * 0.28 * (0.3 + (a.e + b.e) / 2)})`;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        }
      }
    }

    function draw(freq, level) {
      const w = canvas.width;
      const h = canvas.height;
      if (seeded !== `${w}x${h}x${opt.count}`) seed(w, h);

      const cx = w / 2;
      const cy = h / 2;
      const unit = Math.min(w, h);

      /* bass wirkt auf zwei arten, und die duerfen sich nicht vermischen:
         - HALTEN: solange etwas im bassbereich spielt, steht das feld
           weiter offen. das ist der dauerhafte anteil.
         - ANSCHLAG: ein sprung gegenueber dem gleitenden mittel gibt einen
           kurzen stoss obendrauf.
         frueher gab es nur den anschlag — dadurch wurde durchgehender bass
         vom mittelwert aufgesogen und hatte nach kurzer zeit keine
         wirkung mehr. */
      let bass = 0;
      const bassBins = Math.max(1, Math.floor(freq.length * 0.06));
      for (let i = 0; i < bassBins; i++) bass += freq[i];
      bass = bass / bassBins / 255;

      // schnell auf, langsam ab: ein bass-lauf soll nicht flackern
      const rate = bass > hold ? 0.35 : 0.06;
      hold += (bass - hold) * rate;

      if (bass > bassAvg * 1.25 + 0.06) pulse = Math.min(1, pulse + 0.55 * opt.pulse);
      bassAvg += (bass - bassAvg) * 0.12;
      pulse *= 0.90;

      // der dauerhafte anteil, mit dem alle punkte nach aussen stehen
      const driveNow = hold * opt.drive;

      if (opt.trails) {
        // statt loeschen ein hauch hintergrund darueber — das ergibt die spur
        ctx.fillStyle = 'rgba(11, 19, 6, 0.22)';
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.clearRect(0, 0, w, h);
      }

      for (const d of dots) {
        // energie im band dieses punktes, nur bis 65% der baender —
        // darueber ist bei mp3 nichts mehr
        const bin = Math.floor((freq.length - 1) * 0.65 * (d.band ** 1.6));
        d.e = (freq[bin] || 0) / 255;

        // nach aussen druecken: eigenes band plus der gemeinsame stoss
        const dx = d.x - cx;
        const dy = d.y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const push = (d.e * 0.9 + pulse * 1.4) * unit * 0.0016 * opt.reach;
        d.vx += (dx / dist) * push;
        d.vy += (dy / dist) * push;

        /* die feder zieht nicht zum ruheplatz, sondern zu einem punkt, der
           mit dem bass nach aussen wandert. solange bass spielt, steht das
           feld dadurch dauerhaft weiter offen statt zurueckzufallen. */
        const spread = 1 + driveNow * 0.45;
        const tx = cx + (d.hx - cx) * spread;
        const ty = cy + (d.hy - cy) * spread;
        d.vx += (tx - d.x) * 0.012 * opt.spring;
        d.vy += (ty - d.y) * 0.012 * opt.spring;
        d.vx *= 0.90;
        d.vy *= 0.90;

        // leichtes eigenleben, damit es auch bei stille nicht erstarrt
        d.drift += 0.01;
        d.x += d.vx + Math.cos(d.drift) * 0.12;
        d.y += d.vy + Math.sin(d.drift * 0.8) * 0.12;
      }

      if (opt.connect) connectDots(w, h, unit * 0.11);

      for (const d of dots) {
        const bright = Math.min(1, 0.18 + d.e * 0.9 + pulse * 0.4 + driveNow * 0.15);
        const size = opt.pump
          ? d.size * (1 + d.e * 1.1 + pulse * 0.5)
          : d.size;
        const [r, g, bl] = opt.tint ? d.tone : [168, 179, 135];
        ctx.beginPath();
        ctx.arc(d.x, d.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${bl}, ${bright})`;
        ctx.fill();
      }

      // ein ruhiger kreis in der mitte, der mit der lautstaerke atmet
      ctx.beginPath();
      ctx.arc(cx, cy, unit * (0.05 + level * 0.05 + pulse * 0.02 + driveNow * 0.03), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(108, 194, 61, ${0.25 + level * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // einstellungen zur laufzeit aendern — die vorschau im editor braucht das
    function configure(next) {
      opt = { ...opt, ...next };
      seeded = '';
    }

    return { draw, configure };
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

  return { drawWaveform, particles, VIZ_DEFAULTS, fit, loadWaveform, formatTime };
})();
