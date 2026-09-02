// =========================================================================
// wellenform einer audiodatei
// =========================================================================
// die kachel im portfolio zeigt die wellenform des ganzen stuecks, so wie
// man es von soundcloud kennt. sie wird beim upload einmal berechnet und
// als kleine datei neben der audiodatei abgelegt — die uebersicht laedt
// also nie die audiodatei selbst.
//
// dieselben daten tragen auf der detailseite den abspielbalken.

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { ffmpegAvailable } from './poster.js';

const run = promisify(execFile);

const RATE = 8000;      // fuer huellkurven reicht das voellig
const BUCKETS = 512;    // balken ueber die ganze breite

export async function makeWaveform(src) {
  if (!src || !src.startsWith('/uploads/')) return null;
  if (!(await ffmpegAvailable())) return null;

  const rel = src.replace(/^\/uploads\//, '');
  const input = path.resolve(config.uploadsDir, rel);
  if (!input.startsWith(config.uploadsDir + path.sep)) return null;
  if (!fs.existsSync(input)) return null;

  let pcm;
  try {
    // mono, 16 bit, direkt als rohdaten auf stdout
    const { stdout } = await run('ffmpeg', [
      '-v', 'error', '-i', input,
      '-ac', '1', '-ar', String(RATE), '-f', 's16le', '-',
    ], { maxBuffer: 256 * 1024 * 1024, encoding: 'buffer', timeout: 300_000 });
    pcm = new Int16Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.length / 2));
  } catch {
    return null;
  }

  if (pcm.length < BUCKETS) return null;

  const duration = pcm.length / RATE;
  const per = pcm.length / BUCKETS;
  const raw = new Float32Array(BUCKETS);

  for (let i = 0; i < BUCKETS; i++) {
    const from = Math.floor(i * per);
    const to = Math.min(pcm.length, Math.floor((i + 1) * per));

    // spitzenwert UND effektivwert: der spitzenwert allein macht bei
    // gemasterter musik einen gleichmaessigen block, der effektivwert allein
    // sieht schlapp aus. die mischung zeigt beides — dynamik und anschlaege.
    let peak = 0;
    let sum = 0;
    for (let s = from; s < to; s++) {
      const v = Math.abs(pcm[s]);
      if (v > peak) peak = v;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / Math.max(1, to - from));
    raw[i] = (peak * 0.6 + rms * 1.6) / 32768;
  }

  // auf den lautesten punkt der datei strecken, damit leise aufnahmen nicht
  // als flache linie erscheinen
  let max = 0;
  for (const v of raw) if (v > max) max = v;
  const scale = max > 0 ? 1 / max : 0;

  const data = new Uint8Array(BUCKETS);
  for (let i = 0; i < BUCKETS; i++) {
    // leichte wurzel-kennlinie: hebt die leisen stellen an, ohne die
    // lauten abzuflachen. ohne sie sieht fast alles gleich hoch aus.
    data[i] = Math.round(Math.min(1, (raw[i] * scale) ** 0.85) * 255);
  }

  const outRel = `${rel.replace(/\.[^.]+$/, '')}-wave.json`;
  const output = path.resolve(config.uploadsDir, outRel);
  fs.writeFileSync(output, JSON.stringify({
    buckets: BUCKETS,
    duration: Math.round(duration * 100) / 100,
    // base64 statt einer zahlenliste: ein drittel der groesse
    peaks: Buffer.from(data).toString('base64'),
  }));

  return `/uploads/${outRel}`;
}
