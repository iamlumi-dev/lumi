// zentrale konfiguration — liest .env, faellt auf sinnvolle defaults zurueck
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');

const bool = (v, fallback = false) =>
  v === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());

export const config = {
  port: Number(process.env.PORT) || 3000,
  env: process.env.NODE_ENV || 'development',
  get isProd() {
    return this.env === 'production';
  },
  databasePath: path.resolve(ROOT, process.env.DATABASE_PATH || './data/lumiswork.db'),
  publicDir: path.join(ROOT, 'public'),
  uploadsDir: path.join(ROOT, 'public', 'uploads'),
  sessionSecret: process.env.SESSION_SECRET || '',
  trustProxy: bool(process.env.TRUST_PROXY, false),

  // wie lange eine admin-session gilt
  sessionDays: Number(process.env.SESSION_DAYS) || 14,

  // obergrenze pro hochgeladener datei in megabyte. 0 = kein limit.
  // achtung: der reverse proxy hat sein eigenes limit, siehe SETUP.md.
  maxUploadMb: (() => {
    const raw = process.env.MAX_UPLOAD_MB;
    if (raw === undefined || raw === '') return 500;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 500;
  })(),

  // marke — an genau einer stelle aenderbar
  site: {
    name: 'lumi',
    portfolioName: 'lumis work',
    year: 2026,
  },
};
