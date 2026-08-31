// befuellt die datenbank mit demo-inhalten, damit das portfolio direkt etwas
// zu zeigen hat. aufruf:  npm run db:seed  (bzw. mit --reset zum ueberschreiben)
import { db } from '../server/db.js';
import { generatePlaceholders } from './placeholders.js';

const reset = process.argv.includes('--reset');

const existing = db.prepare('SELECT COUNT(*) AS n FROM posts').get().n;
if (existing > 0 && !reset) {
  console.log(`! es liegen bereits ${existing} posts in der datenbank — nichts getan.`);
  console.log('  zum ueberschreiben:  npm run db:seed -- --reset');
  process.exit(0);
}

if (reset) {
  db.exec('DELETE FROM post_categories; DELETE FROM media; DELETE FROM posts; DELETE FROM categories; DELETE FROM pages;');
  console.log('… alte inhalte gelöscht');
}

const { images, av } = generatePlaceholders();

const CATEGORIES = [
  { slug: 'generative', name: 'generative', description: 'code, der bilder wachsen lässt' },
  { slug: 'sound', name: 'sound', description: 'alles, was klingt' },
  { slug: 'motion', name: 'motion', description: 'bewegtbild und schleifen' },
  { slug: 'writing', name: 'writing', description: 'notizen und texte' },
  { slug: 'hardware', name: 'hardware', description: 'dinge zum anfassen' },
];

// jede groesse mindestens einmal, jede medien-kombination mindestens einmal:
// nur text, nur bild, nur audio, nur video, und gemischt.
const POSTS = [
  {
    slug: 'root-system', title: 'root system', size: 'large', pinned: 1,
    summary: 'ein wachstumsalgorithmus, der von den bildschirmrändern nach innen kriecht.',
    body: 'jede wurzel startet mit einer zufälligen dicke und verjüngt sich pro schritt. die richtung kommt aus perlin-noise, gelegentlich knickt sie hart ab. wird eine wurzel zu dünn, verblasst sie und wird entfernt.\n\ngeschrieben in p5.js, läuft als hintergrund dieser seite.',
    categories: ['generative'],
    media: [
      { kind: 'image', src: images.a, alt: 'wurzelartige linien, die nach innen wachsen', is_cover: 1 },
      { kind: 'image', src: images.c, alt: 'dichteres wurzelgeflecht' },
    ],
  },
  {
    slug: 'wheat-field', title: 'wheat field', size: 'wide',
    summary: 'ein punktraster, das sehr langsam im wind steht.',
    body: '22 pixel abstand, jeder punkt per 3d-noise verschoben. die z-achse läuft mit 0.005 pro frame weiter — das feld weht, ohne dass man die einzelne bewegung sieht.',
    categories: ['generative', 'motion'],
    media: [{ kind: 'image', src: images.b, alt: 'punktraster wie ein weizenfeld', is_cover: 1 }],
  },
  {
    slug: 'drone-for-empty-rooms', title: 'drone for empty rooms', size: 'small',
    summary: 'zwölf minuten, zwei oszillatoren, kein takt.',
    body: 'aufgenommen an einem nachmittag mit einem modularen aufbau. sample-and-hold auf der filterfrequenz, sonst nichts.',
    categories: ['sound'],
    media: av.audio ? [{ kind: 'audio', src: av.audio, alt: 'ruhiger drone', caption: 'drone i' }] : [],
  },
  {
    slug: 'slow-signal', title: 'slow signal', size: 'tall',
    summary: 'bewegtbild aus einer einzigen mathematischen funktion.',
    body: 'kein material, keine kamera. die helligkeit jedes pixels ist eine funktion von x, y und der zeit. mehr braucht es nicht.',
    categories: ['motion', 'generative'],
    media: av.video
      ? [{ kind: 'video', src: av.video, poster: av.poster, alt: 'langsam driftendes muster', is_cover: 1 }]
      : [{ kind: 'image', src: images.d, alt: 'vertikales muster', is_cover: 1 }],
  },
  {
    slug: 'notes-on-quiet-interfaces', title: 'notes on quiet interfaces', size: 'small',
    summary: 'warum navigation verschwinden darf.',
    body: 'die meisten oberflächen schreien. sie wollen, dass man klickt, und sagen es einem laut. ein interface darf aber auch warten.\n\nwenn die buttons erst sichtbar werden, sobald man den inhalt anschaut, passiert etwas: man liest zuerst. das ist die ganze idee.\n\ndas kostet nichts außer einer media query und ein bisschen geduld.',
    categories: ['writing'],
    media: [],
  },
  {
    slug: 'field-recorder-mk1', title: 'field recorder mk1', size: 'wide',
    summary: 'ein rekorder aus resten, gebaut an einem wochenende.',
    body: 'gehäuse aus einer alten kassettenbox, innen ein mikrocontroller und ein mikrofon-breakout. nimmt auf eine sd-karte auf, ein knopf, eine leuchtdiode.\n\nklingt schlechter als alles gekaufte und genau deswegen gut.',
    categories: ['hardware', 'sound'],
    media: [
      { kind: 'image', src: images.f, alt: 'abstraktes muster als platzhalter für ein gerätefoto', is_cover: 1 },
      ...(av.audio ? [{ kind: 'audio', src: av.audio, alt: 'testaufnahme', caption: 'testaufnahme, erster versuch' }] : []),
    ],
  },
  {
    slug: 'everything-at-once', title: 'everything at once', size: 'banner',
    summary: 'ein post, der bild, ton, bewegtbild und text gleichzeitig trägt — als beleg, dass nichts voneinander abhängt.',
    body: 'die medien eines posts sind eine liste. bild, video und audio stehen gleichberechtigt nebeneinander, in beliebiger reihenfolge und beliebiger anzahl. ein post ohne medien ist genauso gültig wie einer mit fünf.',
    categories: ['generative', 'sound', 'motion'],
    media: [
      { kind: 'image', src: images.e, alt: 'breites wurzelmuster', is_cover: 1 },
      ...(av.video ? [{ kind: 'video', src: av.video, poster: av.poster, alt: 'bewegtes muster' }] : []),
      ...(av.audio ? [{ kind: 'audio', src: av.audio, alt: 'begleitender ton' }] : []),
    ],
  },
  {
    slug: 'plotter-studies', title: 'plotter studies', size: 'small',
    summary: 'linien, die eine maschine gezogen hat.',
    body: 'serie von acht blättern, jedes eine variation derselben schleife mit anderem noise-seed.',
    categories: ['generative', 'hardware'],
    media: [{ kind: 'image', src: images.c, alt: 'linienzeichnung', is_cover: 1 }],
  },
  {
    slug: 'a-list-of-things-that-hum', title: 'a list of things that hum', size: 'small',
    summary: 'kühlschrank, trafo, autobahn, kopf.',
    body: 'eine sammlung, die nie fertig wird. der kühlschrank brummt in etwa auf einem tiefen c, die autobahn ist breiter und hat keine tonhöhe. der kopf kommt erst nachts dazu.',
    categories: ['writing', 'sound'],
    media: [],
  },
  {
    slug: 'terminal-green', title: 'terminal green', size: 'tall',
    summary: 'eine palette aus fünf farben und die frage, ob das reicht.',
    body: 'es reicht. unterschiede entstehen über helligkeit, deckkraft und kursivschrift — nicht über den farbton. sobald man eine zweite farbfamilie zulässt, fängt das feilschen an.',
    categories: ['writing', 'generative'],
    media: [{ kind: 'image', src: images.d, alt: 'hochformatiges punktmuster', is_cover: 1 }],
  },
];

const PAGES = [
  {
    slug: 'about',
    title: 'whoami',
    body: 'lumi baut dinge, die meistens grün sind und selten fertig.\n\ndieser text ist ein platzhalter — den echten schreiben wir noch gemeinsam.',
  },
];

// ---- schreiben ------------------------------------------------------------
const insertCategory = db.prepare(
  'INSERT INTO categories (slug, name, description, position) VALUES (?, ?, ?, ?)'
);
const insertPost = db.prepare(`
  INSERT INTO posts (slug, title, summary, body, size, pinned, published, published_at)
  VALUES (@slug, @title, @summary, @body, @size, @pinned, 1, @published_at)
`);
const insertMedia = db.prepare(`
  INSERT INTO media (post_id, kind, src, poster, alt, caption, is_cover, position)
  VALUES (@post_id, @kind, @src, @poster, @alt, @caption, @is_cover, @position)
`);
const linkCategory = db.prepare(
  'INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)'
);
const insertPage = db.prepare(
  'INSERT INTO pages (slug, title, body) VALUES (@slug, @title, @body)'
);

db.transaction(() => {
  const catId = new Map();
  CATEGORIES.forEach((c, i) => {
    catId.set(c.slug, insertCategory.run(c.slug, c.name, c.description, i).lastInsertRowid);
  });

  // aeltester post zuerst datieren, damit die sortierung "neueste oben" sichtbar wird
  POSTS.forEach((p, i) => {
    const day = String(POSTS.length - i).padStart(2, '0');
    const postId = insertPost.run({
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      body: p.body,
      size: p.size,
      pinned: p.pinned ? 1 : 0,
      published_at: `2026-0${1 + (i % 8)}-${day} 12:00:00`,
    }).lastInsertRowid;

    p.media.forEach((m, j) =>
      insertMedia.run({
        post_id: postId,
        kind: m.kind,
        src: m.src,
        poster: m.poster || null,
        alt: m.alt || '',
        caption: m.caption || '',
        is_cover: m.is_cover ? 1 : 0,
        position: j,
      })
    );

    p.categories.forEach((slug) => linkCategory.run(postId, catId.get(slug)));
  });

  PAGES.forEach((pg) => insertPage.run(pg));
})();

console.log(`✓ ${CATEGORIES.length} kategorien, ${POSTS.length} posts, ${PAGES.length} seite(n) angelegt`);
