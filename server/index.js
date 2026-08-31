// =========================================================================
// lumiswork — server
// =========================================================================
// liefert die statischen seiten aus /public und eine kleine json-api unter /api.
// der admin-bereich (login + posts anlegen) kommt spaeter dazu; die stellen,
// an denen er andockt, sind unten mit ADMIN markiert.

import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { config } from './config.js';
import { api } from './routes/api.js';
import { auth } from './routes/auth.js';
import { admin } from './routes/admin.js';
import { withSession, requireAuth, requireCsrf } from './auth.js';

const app = express();

// hinter nginx/caddy: echte client-ip durchreichen (wichtig fuer rate-limiting)
app.set('trust proxy', config.trustProxy ? 1 : false);
app.disable('x-powered-by');

// ---- sicherheits-header ---------------------------------------------------
// CSP ist bewusst eng. die beiden erlaubten fremd-hosts sind google fonts und
// das p5.js-cdn — beide stehen so im style guide.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", 'https://cdnjs.cloudflare.com'],
        'style-src': ["'self'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        // i.ytimg.com liefert die vorschaubilder der youtube-facade,
        // youtube-nocookie.com den player, der erst nach einem klick laedt
        'img-src': ["'self'", 'data:', 'blob:', 'https://i.ytimg.com'],
        'media-src': ["'self'", 'blob:'],
        'connect-src': ["'self'"],
        'frame-src': ['https://www.youtube-nocookie.com'],
        'frame-ancestors': ["'none'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'upgrade-insecure-requests': config.isProd ? [] : null,
      },
    },
    // erlaubt das laden von p5 und fonts von fremd-origins
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: config.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  })
);

app.use(compression());
app.use(cookieParser());

// json-koerper nur fuer die api; upload-routen brauchen ihn nicht
app.use('/api', express.json({ limit: '256kb' }));

// haengt req.session an, wenn ein gueltiges cookie mitkommt
app.use(withSession);

// ---- rate limiting --------------------------------------------------------
// grosszuegig fuer normale besucher, bremst aber scraper und brute-force.
app.use(
  '/api',
  rateLimit({
    windowMs: 60_000,
    limit: 240,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'zu viele anfragen' },
  })
);

// ---- riegel vor dem statischen ausliefern ---------------------------------
// die editor-oberflaeche liegt unter public/admin/, also im ordner, den
// express.static bedient. der schutz muss deshalb VOR dem statischen handler
// stehen — sonst wuerde der die dateien vorher ungeschuetzt herausgeben.
// gilt fuer /admin, /admin/ und alles darunter.
app.use('/admin', requireAuth);

// ---- statische dateien ----------------------------------------------------
// hochgeladene medien: lang cachen, aber niemals als html/script ausliefern.
app.use(
  '/uploads',
  express.static(config.uploadsDir, {
    maxAge: config.isProd ? '30d' : 0,
    index: false,
    dotfiles: 'ignore',
    setHeaders: (res) => {
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Content-Disposition', 'inline');
    },
  })
);

app.use(
  express.static(config.publicDir, {
    maxAge: config.isProd ? '1h' : 0,
    extensions: ['html'],
    index: 'index.html',
    dotfiles: 'ignore',
  })
);

// ---- anmeldung ------------------------------------------------------------
app.use('/api/auth', auth);

// ---- geschuetzte schreib-api ----------------------------------------------
// reihenfolge ist hier die halbe sicherheit: erst pruefen, ob ueberhaupt
// jemand angemeldet ist, dann das csrf-token, erst danach die routen.
app.use('/api/admin', requireAuth, requireCsrf, admin);

// ---- oeffentliche api -----------------------------------------------------
app.use('/api', api);

// ---- seiten-routen --------------------------------------------------------
// detailseite eines posts: /portfolio/<slug>/ liefert dieselbe html-huelle,
// die sich ihre daten dann per api holt.
const page = (file) => (req, res) => res.sendFile(path.join(config.publicDir, file));

app.get('/portfolio/:slug', (req, res, next) => {
  // reservierte namen nicht abfangen (sonst kollidiert es mit echten dateien)
  if (['post.html', 'index.html'].includes(req.params.slug)) return next();
  page('portfolio/post.html')(req, res);
});

// ---- 404 ------------------------------------------------------------------
app.use((req, res) => {
  res.status(404);
  if (req.accepts('html')) return res.sendFile(path.join(config.publicDir, '404.html'));
  res.type('txt').send('not found');
});

// ---- fehlerbehandlung -----------------------------------------------------
app.use((err, req, res, _next) => {
  // kaputtes json ist ein bedienfehler, kein serverfehler — und nichts,
  // was im log auftauchen muss
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'ungültiges json' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'anfrage zu groß' });
  }

  console.error(err);
  res.status(err.status || 500);
  // keine stacktraces nach draussen
  if (req.originalUrl.startsWith('/api/')) return res.json({ error: 'interner fehler' });
  res.type('txt').send('interner fehler');
});

app.listen(config.port, () => {
  console.log(`lumiswork läuft auf http://localhost:${config.port}  [${config.env}]`);
});
