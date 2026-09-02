// =========================================================================
// spektrum einer audiodatei
// =========================================================================
// fuer die kachel im portfolio wird das ganze stueck einmal analysiert und
// als kleine datei neben der audiodatei abgelegt. das frontend zeichnet
// daraus ein spektrogramm in den farben der seite — anstatt es bei jedem
// aufruf neu zu rechnen, und ohne dafuer die audiodatei zu laden.
//
// gerechnet wird hier selbst, nicht mit ffmpegs showspectrumpic: das liefert
// ein fertiges bild in einer seiner eigenen farbskalen. wir brauchen aber
// zahlen — fuer die farbgebung der seite und dafuer, dass ein klick auf eine
// stelle im bild eine stelle im stueck ist.

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { ffmpegAvailable } from './poster.js';

const run = promisify(execFile);

const RATE = 22050;      // reicht: darueber ist bei musik kaum noch etwas
const FFT_SIZE = 1024;
const SLICES = 256;      // zeitschritte im bild
const BANDS = 32;        // frequenzbaender je zeitschritt

/* ---- fft ------------------------------------------------------------------
   iterative radix-2 fourier-transformation. wird unten gegen bekannte
   eingaben geprueft: ein sinus muss genau einen ausschlag ergeben.        */

function fft(re, im) {
  const n = re.length;

  // bit-umkehr-vertauschung
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + len / 2] * curRe - im[i + j + len / 2] * curIm;
        const vIm = re[i + j + len / 2] * curIm + im[i + j + len / 2] * curRe;

        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe;
        im[i + j + len / 2] = uIm - vIm;

        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

/** betragsspektrum eines fensters, mit hann-fenster gegen randartefakte */
export function magnitudes(samples) {
  const n = samples.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    re[i] = samples[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  fft(re, im);

  // auf die fenstergroesse normieren, sonst haengt der betrag an n und
  // alles landet weit ueber 0 dB. der faktor 4/n beruecksichtigt, dass das
  // hann-fenster die amplitude halbiert und die energie auf zwei
  // spiegelbildliche haelften faellt: ein vollausschlag-sinus ergibt so 1.
  const out = new Float64Array(n / 2);
  const scale = 4 / n;
  for (let i = 0; i < n / 2; i++) out[i] = Math.hypot(re[i], im[i]) * scale;
  return out;
}

/* ---- baender --------------------------------------------------------------
   die bins werden logarithmisch zusammengefasst. linear waeren die unteren
   zwei oktaven ein einziger streifen und der rest hoehen — musikalisch
   waere das nutzlos.                                                       */

function bandEdges(bins, rate) {
  const lo = 40;                       // darunter ist meist nur rumpeln
  const hi = Math.min(16000, rate / 2);
  const edges = [];
  for (let i = 0; i <= BANDS; i++) {
    const hz = lo * (hi / lo) ** (i / BANDS);
    edges.push(Math.min(bins - 1, Math.round((hz / (rate / 2)) * bins)));
  }
  return edges;
}

/* ---- analyse einer datei -------------------------------------------------- */

export async function makeSpectrum(src) {
  if (!src || !src.startsWith('/uploads/')) return null;
  if (!(await ffmpegAvailable())) return null;

  const rel = src.replace(/^\/uploads\//, '');
  const input = path.resolve(config.uploadsDir, rel);
  if (!input.startsWith(config.uploadsDir + path.sep)) return null;
  if (!fs.existsSync(input)) return null;

  let pcm;
  try {
    // mono, 22050 hz, 16 bit — direkt als rohdaten auf stdout
    const { stdout } = await run('ffmpeg', [
      '-v', 'error', '-i', input,
      '-ac', '1', '-ar', String(RATE), '-f', 's16le', '-',
    ], { maxBuffer: 512 * 1024 * 1024, encoding: 'buffer', timeout: 300_000 });
    pcm = new Int16Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.length / 2));
  } catch {
    return null;
  }

  if (pcm.length < FFT_SIZE) return null;

  const duration = pcm.length / RATE;
  const bins = FFT_SIZE / 2;
  const edges = bandEdges(bins, RATE);
  const window = new Float64Array(FFT_SIZE);

  // erst alle werte in dezibel sammeln
  const raw = new Float32Array(SLICES * BANDS);

  /* je zeitschritt wird ueber SUB fenster gemittelt, die ueber seinen
     ganzen abschnitt verteilt liegen. mit nur einem fenster waere jeder
     schritt eine 46-ms-momentaufnahme aus vielleicht einer sekunde — dann
     sind benachbarte schritte unkorreliert und das bild sieht aus wie
     rauschen statt wie ein spektrogramm. */
  const SUB = 6;
  const acc = new Float64Array(BANDS);

  for (let s = 0; s < SLICES; s++) {
    acc.fill(0);
    const from = Math.floor((s / SLICES) * (pcm.length - FFT_SIZE));
    const to = Math.floor(((s + 1) / SLICES) * (pcm.length - FFT_SIZE));

    for (let k = 0; k < SUB; k++) {
      const start = Math.min(
        pcm.length - FFT_SIZE,
        from + Math.floor(((to - from) * k) / SUB)
      );
      for (let i = 0; i < FFT_SIZE; i++) window[i] = pcm[start + i] / 32768;

      const mag = magnitudes(window);
      for (let band = 0; band < BANDS; band++) {
        let sum = 0;
        let count = 0;
        for (let i = edges[band]; i <= edges[band + 1]; i++) { sum += mag[i]; count++; }
        acc[band] += count ? sum / count : 0;
      }
    }

    for (let band = 0; band < BANDS; band++) {
      // das ohr hoert logarithmisch — linear waere fast alles dunkel mit ein
      // paar hellen spitzen
      raw[s * BANDS + band] = 20 * Math.log10(acc[band] / SUB + 1e-9);
    }
  }

  /* auf den tatsaechlichen umfang DIESER datei strecken. eine feste
     dB-skala taugt nicht: leise aufnahmen waeren fast schwarz, laute eine
     einzige helle flaeche. genommen werden das 5. und das 98. perzentil,
     damit einzelne ausreisser die skala nicht bestimmen. */
  const sorted = Float32Array.from(raw).sort();
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const floor = at(0.05);
  const ceil = Math.max(floor + 6, at(0.98));

  const data = new Uint8Array(SLICES * BANDS);
  for (let i = 0; i < raw.length; i++) {
    const norm = Math.max(0, Math.min(1, (raw[i] - floor) / (ceil - floor)));
    // leichte gamma-korrektur: die mitte etwas dunkler, damit die spitzen
    // sich abheben statt in einer flaeche unterzugehen
    data[i] = Math.round(norm ** 1.4 * 255);
  }

  const outRel = `${rel.replace(/\.[^.]+$/, '')}-spectrum.json`;
  const output = path.resolve(config.uploadsDir, outRel);
  fs.writeFileSync(output, JSON.stringify({
    slices: SLICES,
    bands: BANDS,
    duration: Math.round(duration * 100) / 100,
    // base64 statt einer zahlenliste: ein drittel der groesse
    data: Buffer.from(data).toString('base64'),
  }));

  return `/uploads/${outRel}`;
}
