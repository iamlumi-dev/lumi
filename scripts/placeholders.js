// erzeugt platzhalter-medien fuer die demo-inhalte.
// bilder werden generativ als svg gezeichnet (passt zur regel "grafik entsteht
// nur generativ"), video und audio kommen per ffmpeg — fehlt ffmpeg, werden sie
// einfach uebersprungen.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { config } from '../server/config.js';

const OUT = path.join(config.uploadsDir, 'seed');
const LINE = 'rgb(168, 179, 135)';   // staubiges olivgruen, wie der canvas
const BG = 'rgb(20, 24, 20)';

// kleiner deterministischer PRNG, damit die platzhalter reproduzierbar sind
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// variante a: wurzeln, die von den raendern nach innen wachsen
function rootsSvg(seed, w, h) {
  const r = rng(seed);
  const paths = [];
  for (let i = 0; i < 14; i++) {
    const edge = Math.floor(r() * 4);
    let x = edge === 0 ? 0 : edge === 2 ? w : r() * w;
    let y = edge === 1 ? 0 : edge === 3 ? h : r() * h;
    let a = Math.atan2(h / 2 - y, w / 2 - x) + (r() - 0.5);
    let width = 5 + r() * 5;
    let d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    for (let step = 0; step < 40 && width > 0.4; step++) {
      a += (r() - 0.5) * 0.5;
      x += Math.cos(a) * 14;
      y += Math.sin(a) * 14;
      width *= 0.94;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    paths.push(
      `<path d="${d}" stroke="${LINE}" stroke-width="${width.toFixed(2)}" ` +
      `stroke-opacity="0.35" fill="none" stroke-linejoin="bevel" stroke-linecap="square"/>`
    );
  }
  return paths.join('\n  ');
}

// variante b: weizenfeld aus punkten
function wheatSvg(seed, w, h) {
  const r = rng(seed);
  const dots = [];
  const gap = 20;
  for (let y = gap / 2; y < h; y += gap) {
    for (let x = gap / 2; x < w; x += gap) {
      const ox = (r() - 0.5) * 16;
      const oy = (r() - 0.5) * 11;
      const rad = (1.5 + r() * 2).toFixed(2);
      const op = (0.06 + r() * 0.5).toFixed(2);
      dots.push(
        `<circle cx="${(x + ox).toFixed(1)}" cy="${(y + oy).toFixed(1)}" ` +
        `r="${rad}" fill="${LINE}" fill-opacity="${op}"/>`
      );
    }
  }
  return dots.join('\n  ');
}

function writeSvg(name, seed, w, h, kind) {
  const body = kind === 'wheat' ? wheatSvg(seed, w, h) : rootsSvg(seed, w, h);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n` +
    `  <rect width="${w}" height="${h}" fill="${BG}"/>\n  ${body}\n</svg>\n`;
  fs.writeFileSync(path.join(OUT, name), svg);
  return `/uploads/seed/${name}`;
}

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'pipe' });
}

export function generatePlaceholders() {
  fs.mkdirSync(OUT, { recursive: true });

  const images = {
    a: writeSvg('roots-a.svg', 11, 1200, 900, 'roots'),
    b: writeSvg('wheat-b.svg', 29, 1200, 900, 'wheat'),
    c: writeSvg('roots-c.svg', 47, 1600, 900, 'roots'),
    d: writeSvg('wheat-d.svg', 73, 900, 1200, 'wheat'),
    e: writeSvg('roots-e.svg', 91, 1600, 600, 'roots'),
    f: writeSvg('wheat-f.svg', 113, 1200, 1200, 'wheat'),
  };

  const av = {};
  try {
    // langsam driftendes rauschen im palettengruen — kein testbild-bunt
    ffmpeg([
      '-f', 'lavfi', '-i', 'nullsrc=s=960x540:d=8:r=24',
      '-vf', "geq=lum='128+40*sin(X/48+T)*cos(Y/64-T/2)':cb=118:cr=110,format=yuv420p",
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30',
      path.join(OUT, 'motion.mp4'),
    ]);
    av.video = '/uploads/seed/motion.mp4';

    // standbild fuer das video
    ffmpeg([
      '-i', path.join(OUT, 'motion.mp4'), '-frames:v', '1',
      path.join(OUT, 'motion-poster.jpg'),
    ]);
    av.poster = '/uploads/seed/motion-poster.jpg';

    // ruhiger sinus-drone, damit die audio-kachel etwas abzuspielen hat
    ffmpeg([
      '-f', 'lavfi', '-i', 'sine=frequency=110:duration=12',
      '-f', 'lavfi', '-i', 'sine=frequency=164.81:duration=12',
      '-filter_complex', '[0][1]amix=inputs=2,volume=0.25,afade=t=in:d=2,afade=t=out:st=10:d=2',
      '-c:a', 'libmp3lame', '-b:a', '96k',
      path.join(OUT, 'drone.mp3'),
    ]);
    av.audio = '/uploads/seed/drone.mp3';
  } catch (err) {
    console.warn('! ffmpeg nicht verfügbar — video/audio-platzhalter übersprungen');
  }

  return { images, av };
}
