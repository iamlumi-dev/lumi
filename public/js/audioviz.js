/*=== AUDIO-DARSTELLUNG ===*/
/* zwei dinge, die sich die farbskala teilen:
   - das spektrogramm in der kachel, aus vorberechneten daten
   - der lebende visualizer auf der detailseite, aus der web-audio-analyse

   die farben kommen aus den custom properties der seite, nicht aus einer
   eigenen skala. der style guide kennt fuenf farben, und ein spektrum in
   regenbogenfarben waere die erste ausnahme davon.                        */
window.__viz = (function () {
  /* ---- farbskala ---------------------------------------------------------- */

  function readColor(name) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const hex = value.replace('#', '');
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  }

  let ramp = null;

  /** 256 farben von dunkel nach hell, entlang der palette der seite */
  function palette() {
    if (ramp) return ramp;

    const stops = ['--bgclr', '--altbgclr', '--acntclr', '--titleclr', '--txtclr'].map(readColor);
    ramp = new Uint8ClampedArray(256 * 4);

    for (let i = 0; i < 256; i++) {
      const t = (i / 255) * (stops.length - 1);
      const a = Math.floor(t);
      const b = Math.min(stops.length - 1, a + 1);
      const f = t - a;
      for (let c = 0; c < 3; c++) {
        ramp[i * 4 + c] = stops[a][c] + (stops[b][c] - stops[a][c]) * f;
      }
      ramp[i * 4 + 3] = 255;
    }
    return ramp;
  }

  /* ---- spektrogramm fuer die kachel ---------------------------------------- */

  /**
   * zeichnet das vorberechnete spektrogramm.
   * zeit laeuft nach rechts, tiefe frequenzen liegen unten.
   */
  function drawSpectrogram(canvas, spec) {
    const { slices, bands } = spec;
    const bytes = spec.bytes;
    const colors = palette();

    // erst in voller datenaufloesung zeichnen, dann skaliert uebertragen.
    // das ist schneller als tausende einzelne rechtecke.
    const src = document.createElement('canvas');
    src.width = slices;
    src.height = bands;
    const sctx = src.getContext('2d');
    const img = sctx.createImageData(slices, bands);

    for (let s = 0; s < slices; s++) {
      for (let band = 0; band < bands; band++) {
        const v = bytes[s * bands + band];
        // zeile 0 oben, aber band 0 ist die tiefste frequenz → spiegeln
        const px = ((bands - 1 - band) * slices + s) * 4;
        img.data[px] = colors[v * 4];
        img.data[px + 1] = colors[v * 4 + 1];
        img.data[px + 2] = colors[v * 4 + 2];
        img.data[px + 3] = 255;
      }
    }
    sctx.putImageData(img, 0, 0);

    const ctx = canvas.getContext('2d');
    // kantig statt weichgezeichnet — passt zur terminal-anmutung
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  }

  /* ---- lebender visualizer ------------------------------------------------- */

  /* ferrofluid: eine dunkle masse, aus der spitzen herauswachsen. jede
     spitze haengt an einem frequenzband. das aussehen kommt daher, dass die
     spitzen spitz sind und die taeler dazwischen rund bleiben — deshalb pro
     spitze drei stuetzpunkte statt einer glatten kurve durch alle werte. */

  function ferrofluid(canvas) {
    const ctx = canvas.getContext('2d');
    const SPIKES = 48;
    const HALF = SPIKES / 2;
    const smooth = new Float32Array(SPIKES);
    let breathe = 0;

    function draw(freq, level) {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const unit = Math.min(w, h);
      const base = unit * 0.16;
      const reach = unit * 0.28;

      breathe += 0.02;
      ctx.clearRect(0, 0, w, h);

      /* die frequenzen liegen gespiegelt auf dem kreis: oben die tiefen,
         unten die hohen, links wie rechts gleich. eine einseitige verteilung
         sieht aus wie ein defekt, keine wie ferrofluid. */
      for (let i = 0; i < SPIKES; i++) {
        const mirrored = i < HALF ? i : SPIKES - i;
        const t = mirrored / HALF;

        /* logarithmisch greifen, sonst passiert alles im untersten viertel.
           und nur bis etwa 65% der baender: darueber liegt bei mp3 der
           tiefpass, die bins sind dort schlicht leer — ohne die grenze
           faellt die figur genau dort in sich zusammen. */
        const bin = Math.floor((freq.length - 1) * 0.65 * (t ** 1.7));
        let v = (freq[bin] || 0) / 255;

        // hoehen anheben: in musik tragen sie viel weniger energie, ohne
        // das bleibt die halbe figur flach
        v *= 0.6 + 2.1 * t;

        // die masse faellt nie ganz zusammen
        v = Math.max(v, 0.07);

        // im ruhezustand leicht atmen, damit nicht nur ein kreis dasteht
        if (level < 0.01) v = 0.05 + 0.04 * Math.sin(breathe + i * 0.4);

        smooth[i] += (Math.min(1, v) - smooth[i]) * 0.3;
      }

      const point = (i, r) => {
        const a = (i / SPIKES) * Math.PI * 2 - Math.PI / 2;
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      };

      /* das taleben zwischen zwei spitzen richtet sich nach der KLEINEREN
         der beiden nachbarn. dadurch verschmelzen laute nachbarn zu einer
         masse mit spitzen obendrauf, statt einzelne nadeln zu bleiben —
         genau das macht den ferrofluid-eindruck aus. */
      const valley = (i) => {
        const a = smooth[(i + SPIKES) % SPIKES];
        const b = smooth[(i + 1) % SPIKES];
        return base + reach * Math.min(a, b) * 1.15;
      };
      const tip = (i) => base + reach * (smooth[i] ** 1.25) * 2.1;

      ctx.beginPath();
      for (let i = 0; i < SPIKES; i++) {
        const [sx, sy] = point(i - 0.5, valley(i - 1));
        const [tx, ty] = point(i, tip(i));
        const [ex, ey] = point(i + 0.5, valley(i));

        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
        ctx.quadraticCurveTo(tx, ty, ex, ey);
      }
      ctx.closePath();

      const fill = ctx.createRadialGradient(cx, cy, base * 0.3, cx, cy, base + reach * 2);
      fill.addColorStop(0, `rgba(108, 194, 61, ${0.4 + level * 0.35})`);
      fill.addColorStop(0.5, 'rgba(54, 97, 30, 0.6)');
      fill.addColorStop(1, 'rgba(54, 97, 30, 0.05)');
      ctx.fillStyle = fill;
      ctx.fill();

      ctx.strokeStyle = `rgba(181, 225, 158, ${0.45 + level * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ruhender kern: die masse, aus der die spitzen kommen
      ctx.beginPath();
      ctx.arc(cx, cy, base * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(11, 19, 6, 0.9)';
      ctx.fill();
      ctx.strokeStyle = `rgba(108, 194, 61, ${0.5 + level * 0.5})`;
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

  /** spektrumdatei laden und die base64-daten auspacken */
  async function loadSpectrum(src) {
    const res = await fetch(src);
    if (!res.ok) throw new Error('spektrum nicht ladbar');
    const spec = await res.json();
    const raw = atob(spec.data);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return { ...spec, bytes };
  }

  const formatTime = (secs) => {
    if (!isFinite(secs) || secs < 0) return '–:––';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return { palette, drawSpectrogram, ferrofluid, fit, loadSpectrum, formatTime };
})();
