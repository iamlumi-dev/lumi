// =========================================================================
// abgeleitete medien: standbilder fuer videos, kleine fassungen fuer bilder
// =========================================================================
// warum das ueberhaupt sein muss: ohne standbild bleibt eine video-kachel
// leer, bis man sie anfasst. mit preload="metadata" wuerde der browser
// stattdessen die metadaten holen — bei einem mp4, dessen moov-atom am ende
// liegt, heisst das: fast die ganze datei. bei vier videos von 40 bis 110 MB
// waeren das ueber 250 MB, nur fuer vier standbilder.
//
// mit einem erzeugten standbild im poster-attribut zeigt der browser ein
// bild von wenigen kilobyte und laedt vom video selbst gar nichts, bis
// jemand abspielt.

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';

const run = promisify(execFile);

/** liegt ffmpeg auf diesem rechner? ergebnis wird gemerkt. */
let available = null;

export async function ffmpegAvailable() {
  if (available !== null) return available;
  try {
    await run('ffmpeg', ['-version'], { timeout: 5000 });
    available = true;
  } catch {
    available = false;
  }
  return available;
}

/**
 * erzeugt ein standbild neben der videodatei.
 * @param {string} src  pfad wie in der datenbank, z.b. /uploads/media/x.mp4
 * @returns {Promise<string|null>} pfad des standbilds, oder null
 */
export async function makePoster(src) {
  if (!src || !src.startsWith('/uploads/')) return null;
  if (!(await ffmpegAvailable())) return null;

  const rel = src.replace(/^\/uploads\//, '');
  const input = path.resolve(config.uploadsDir, rel);

  // pfad muss innerhalb des upload-ordners liegen (schutz gegen ../)
  if (!input.startsWith(config.uploadsDir + path.sep)) return null;
  if (!fs.existsSync(input)) return null;

  const outRel = `${rel.replace(/\.[^.]+$/, '')}-poster.jpg`;
  const output = path.resolve(config.uploadsDir, outRel);

  try {
    // eine sekunde hinein, nicht bild null: der erste frame ist bei
    // vielen videos schwarz. -frames:v 1 bricht danach sofort ab, es wird
    // also nur der anfang der datei gelesen.
    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-ss', '1',
      '-i', input,
      '-frames:v', '1',
      '-vf', 'scale=1280:-2',
      '-q:v', '4',
      output,
    ], { timeout: 60_000 });

    if (!fs.existsSync(output)) return null;
    return `/uploads/${outRel}`;
  } catch {
    // notfalls das allererste bild, falls das video kuerzer als eine sekunde ist
    try {
      await run('ffmpeg', [
        '-y', '-loglevel', 'error',
        '-i', input,
        '-frames:v', '1',
        '-vf', 'scale=1280:-2',
        '-q:v', '4',
        output,
      ], { timeout: 60_000 });
      return fs.existsSync(output) ? `/uploads/${outRel}` : null;
    } catch {
      return null;
    }
  }
}

/* ---- kleine fassung eines bildes ----------------------------------------
   die kachelansicht braucht kein 6372x6372-png von 46 MB. hier entsteht
   eine fassung fuer die uebersicht; das original bleibt liegen und wird
   auf der detailseite gezeigt. */

// erst ab dieser groesse lohnt es sich
const THUMB_MIN_BYTES = 300 * 1024;
const THUMB_WIDTH = 1200;

export async function makeThumb(src) {
  if (!src || !src.startsWith('/uploads/')) return null;
  if (!(await ffmpegAvailable())) return null;

  const rel = src.replace(/^\/uploads\//, '');
  const input = path.resolve(config.uploadsDir, rel);
  if (!input.startsWith(config.uploadsDir + path.sep)) return null;
  if (!fs.existsSync(input)) return null;

  // kleine dateien bleiben, wie sie sind
  if (fs.statSync(input).size < THUMB_MIN_BYTES) return null;

  const outRel = `${rel.replace(/\.[^.]+$/, '')}-thumb.jpg`;
  const output = path.resolve(config.uploadsDir, outRel);

  try {
    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', input,
      // nur verkleinern, nie hochrechnen
      '-vf', `scale='min(${THUMB_WIDTH},iw)':-2`,
      '-q:v', '4',
      output,
    ], { timeout: 120_000 });

    if (!fs.existsSync(output)) return null;

    // wenn die kleine fassung nicht kleiner ist, bringt sie nichts
    if (fs.statSync(output).size >= fs.statSync(input).size) {
      fs.rmSync(output, { force: true });
      return null;
    }
    return `/uploads/${outRel}`;
  } catch {
    return null;
  }
}
