// befuellt die datenbank mit demo-inhalten, damit das portfolio direkt etwas
// zu zeigen hat. aufruf:  npm run db:seed  (bzw. mit --reset zum ueberschreiben)
import { db } from '../server/db.js';
import { generatePlaceholders } from './placeholders.js';
import { backupDatabase } from './backup.js';

const reset = process.argv.includes('--reset');
const force = process.argv.includes('--force');

const existing = db.prepare('SELECT COUNT(*) AS n FROM posts').get().n;
if (existing > 0 && !reset) {
  console.log(`! es liegen bereits ${existing} posts in der datenbank — nichts getan.`);
  console.log('  zum ueberschreiben:  npm run db:seed -- --reset');
  process.exit(0);
}

// die platzhalter-dateien entstehen vor dem loeschen — sie liegen im
// dateisystem, nicht in der datenbank, und stoeren dort niemanden.
const { images, av } = generatePlaceholders();

const CATEGORIES = [
  { slug: 'music', name: 'music', description: 'the main one' },
  { slug: 'visuals', name: 'visuals', description: 'animation and video' },
  { slug: 'artwork', name: 'artwork', description: 'covers and stills' },
  { slug: 'generative', name: 'generative', description: 'code that grows pictures' },
  { slug: 'notes', name: 'notes', description: 'written things' },
];

// jede groesse mindestens einmal, jede medien-kombination mindestens einmal:
// nur text, nur bild, nur audio, nur video, und gemischt.
const POSTS = [
  {
    slug: 'untitled-track-01', title: 'untitled track 01', size: 'large', pinned: 1,
    summary: 'the one that has been ninety percent finished since february.',
    body: 'built in fl studio over a weekend and then rebuilt over four months. the vocal take is the third one, which is usually the right one.\n\nstill unreleased. that one is on lumi.',
    categories: ['music'],
    media: [
      { kind: 'image', src: images.a, alt: 'abstract cover artwork', is_cover: 1 },
      ...(av.audio ? [{ kind: 'audio', src: av.audio, alt: 'rough mix', caption: 'rough mix, not final' }] : []),
    ],
  },
  {
    slug: 'visualiser-for-a-friend', title: 'visualiser for a friend', size: 'wide',
    summary: 'four minutes of animation in davinci resolve for someone else\u2019s song.',
    body: 'no footage, no camera. everything is generated, keyed and graded in resolve until it moves the way the track does.',
    categories: ['visuals', 'music'],
    media: av.video
      ? [{ kind: 'video', src: av.video, poster: av.poster, alt: 'slowly drifting pattern', is_cover: 1 }]
      : [{ kind: 'image', src: images.b, alt: 'still from the visualiser', is_cover: 1 }],
  },
  {
    slug: 'first-take', title: 'first take', size: 'small',
    summary: 'singing since mid 2024. this is what that sounded like early on.',
    body: 'kept for the record, not because it is good.',
    categories: ['music'],
    media: av.audio ? [{ kind: 'audio', src: av.audio, alt: 'early vocal take' }] : [],
  },
  {
    slug: 'cover-studies', title: 'cover studies', size: 'tall',
    summary: 'album covers in photoshop, mostly for records that do not exist yet.',
    body: 'a series of layouts that started as an excuse to open photoshop again. some of them will end up on something.',
    categories: ['artwork'],
    media: [{ kind: 'image', src: images.d, alt: 'cover layout study', is_cover: 1 }],
  },
  {
    slug: 'on-making-things-for-people', title: 'on making things for people', size: 'small',
    summary: 'why a thing made with someone beats a thing made alone in a room.',
    body: 'working alone is faster and worse. every time something has left the room it came back better than it went out.\n\nthat is the entire argument.',
    categories: ['notes'],
    media: [],
  },
  {
    slug: 'wheat-field', title: 'wheat field', size: 'wide',
    summary: 'a grid of dots standing very slowly in the wind.',
    body: '22 pixels apart, each point displaced by 3d noise. the z axis moves 0.005 per frame, so the field drifts without anyone catching it in the act.\n\nit is the background of this site.',
    categories: ['generative', 'visuals'],
    media: [{ kind: 'image', src: images.b, alt: 'a grid of dots like a wheat field', is_cover: 1 }],
  },
  {
    slug: 'everything-at-once', title: 'everything at once', size: 'banner',
    summary: 'one post carrying image, sound, video and text at the same time \u2014 proof that none of them depend on each other.',
    body: 'the media of a post are a list. image, video and audio sit next to each other as equals, in any order and any number. a post with no media is just as valid as one with five.',
    categories: ['music', 'visuals', 'generative'],
    media: [
      { kind: 'image', src: images.e, alt: 'wide abstract pattern', is_cover: 1 },
      ...(av.video ? [{ kind: 'video', src: av.video, poster: av.poster, alt: 'moving pattern' }] : []),
      ...(av.audio ? [{ kind: 'audio', src: av.audio, alt: 'accompanying sound' }] : []),
    ],
  },
  {
    slug: 'root-system', title: 'root system', size: 'small',
    summary: 'a growth algorithm that crawls in from the edges of the screen.',
    body: 'every root starts at a random thickness and tapers with each step. perlin noise steers it, and now and then it snaps off in a new direction.',
    categories: ['generative'],
    media: [{ kind: 'image', src: images.c, alt: 'root-like lines growing inwards', is_cover: 1 }],
  },
  {
    slug: 'a-list-of-things-that-hum', title: 'a list of things that hum', size: 'small',
    summary: 'fridge, transformer, motorway, head.',
    body: 'a collection that will never be finished. the fridge hums somewhere around a low c, the motorway is wider and has no pitch at all. the head only joins in at night.',
    categories: ['notes', 'music'],
    media: [],
  },
  {
    slug: 'terminal-green', title: 'terminal green', size: 'tall',
    summary: 'five colours and the question of whether that is enough.',
    body: 'it is enough. differences come from brightness, opacity and italics \u2014 not from hue. the moment a second colour family is allowed in, the haggling starts.',
    categories: ['notes', 'generative'],
    media: [{ kind: 'image', src: images.f, alt: 'tall dot pattern', is_cover: 1 }],
  },
];


// die drei reiter der about-seite. gleiche tab_group, also erscheinen sie
// nebeneinander und tauschen beim klick nur den mittelteil aus.
const PAGES = [
  {
    slug: 'about',
    title: 'whoami',
    layout: 'prose',
    tab_group: 'about',
    position: 0,
    body: [
      'lumi makes things. music first — that is the main one. then the visuals for it: animation and video in davinci resolve, for own tracks and for the ones by artists lumi likes too much to leave alone. every so often an album cover happens in photoshop.',
      'producing since mid 2022, singing since mid 2024. music has been the thing since about age five, film for roughly as long — which is how davinci ended up in the picture. photoshop came earlier: at ten, on dad’s laptop, strictly to make nonsense. the nonsense has improved.',
      'the work gets taken very seriously. lumi does not. the one thing that does not fly here is doing it for the fame.',
      'none of it is released yet. that one is on lumi. based in germany, always up for collaborations — a thing made with someone beats a thing made alone in a room.',
    ].join('\n\n'),
  },
  {
    slug: 'about-contact',
    title: 'contact',
    layout: 'links',
    tab_group: 'about',
    position: 1,
    body: '',
    // noch leer — der reiter zeigt dann von selbst "coming soon …".
    // format, sobald die handles feststehen:
    //   { label: 'mail', url: 'mailto:name@example.com' },   ← wird gegen scraper geschuetzt
    //   { label: 'bandcamp', url: 'https://…' },
    links: [],
  },
  {
    slug: 'about-setup',
    title: 'setup',
    layout: 'list',
    tab_group: 'about',
    position: 2,
    // im layout "list" gilt: eine zeile, die nur aus einem wort und einem
    // doppelpunkt besteht, eroeffnet eine gruppe. "schluessel: wert" wird zu
    // einer beschrifteten zeile, alles andere zu einem schlichten eintrag.
    body: [
      'software:',
      'music: fl studio',
      'visual: photoshop, davinci resolve',
      'os: cachyos',
      'os, fallback: windows 11 — for what linux cannot do',
      '',
      'desktop:',
      'cpu: ryzen 5 7600x',
      'gpu: rx 6600',
      'memory: 64 gb ddr5',
      'keyboard: endorfy thock v2 75%',
      'mouse: roccat burst core white',
      '',
      'laptop:',
      'cpu: intel i5 1334u, 13th gen',
      'memory: 32 gb ddr4',
      '',
      'audio:',
      'interface: yamaha ur22x',
      'mixing: sennheiser hd 560s',
      'recording: audio-technica ath-m20x',
      'daily: nothing headphone (1), white',
      'mic, casual: focusrite vocaster dm14v',
      'mic, recording: lewitt lct 240 pro',
    ].join('\n'),
  },
  {
    slug: 'shoutouts',
    title: 'shoutouts',
    layout: 'prose',
    tab_group: 'shoutouts',
    position: 0,
    body: 'things other people made that lumi cannot stop playing. nothing here is lumis own work.',
  },
];

// beispiele — bewusst erfundene namen, damit klar ist, dass sie ersetzt
// gehoeren. echte empfehlungen legt lumi im editor an.
const SHOUTOUTS = [
  {
    creator: 'placeholder artist',
    title: 'a song that goes hard',
    kind: 'song',
    url: '',
    note: 'this is an example entry. replace it in the editor — creator, title, a link, and one line about why it rules.',
    date: '2026-08-28',
  },
  {
    creator: 'another placeholder',
    title: 'an entire record',
    kind: 'album',
    url: '',
    note: 'shoutouts do not need a link, a cover or even a title. only the name is required.',
    date: '2026-08-20',
  },
  {
    creator: 'someone worth following',
    title: '',
    kind: 'artist',
    url: '',
    note: '',
    date: '2026-08-11',
  },
];


// splash-texte fuer die startseite. bei jedem aufruf wird eine gezogen.
const SPLASHES = [
  'makes things that are mostly green and rarely finished.',
  'still unreleased!',
  'ninety percent done since february',
  'the third take is always the right one',
  'not for the fame',
  'the nonsense has improved',
  'mixed at 2am, mastered never',
  'one more plugin and it is done',
  'rendering …',
  'ask about the modular',
  'green on green on green',
  'the fridge hums in c',
  'cachyos btw',
  'also does covers',
  'no bpm, no plan',
  'this line is picked at random',
  'try typing help down there',
];

if (reset) {
  // ---------------------------------------------------------------------
  // ab hier wird geloescht. zwei sicherungen davor:
  //
  //   1. eine kopie der datenbank, immer, ohne ausnahme
  //   2. ein abbruch, wenn inhalte drin stehen, die nicht aus diesem seed
  //      stammen — die waeren sonst weg, und genau das ist schon passiert
  // ---------------------------------------------------------------------
  await backupDatabase('vor-seed-reset');

  const own = findOwnContent();
  if (own.length && !force) {
    console.error('\n✗ abgebrochen: in der datenbank stehen eigene inhalte.\n');
    for (const line of own) console.error(`    ${line}`);
    console.error('\n  die sicherung von eben liegt unter data/backups/.');
    console.error('  wirklich alles verwerfen:  npm run db:seed -- --reset --force\n');
    process.exit(1);
  }
  if (own.length) {
    console.log('! --force: die folgenden eigenen inhalte werden verworfen');
    for (const line of own) console.log(`    ${line}`);
  }

  db.exec('DELETE FROM post_categories; DELETE FROM media; DELETE FROM posts; DELETE FROM categories; DELETE FROM links; DELETE FROM pages; DELETE FROM splashes; DELETE FROM shoutouts;');
  console.log('… alte inhalte gelöscht');
}

// zaehlt alles, was nicht wortwoertlich aus den listen unten stammt.
// benutzer und sessions fasst der seed ohnehin nie an.
function findOwnContent() {
  const out = [];
  const check = (label, rows, known) => {
    const extra = rows.filter((r) => !known.has(r));
    if (extra.length) {
      const shown = extra.slice(0, 4).map((e) => `"${String(e).slice(0, 50)}"`).join(', ');
      out.push(`${extra.length} ${label}: ${shown}${extra.length > 4 ? ' …' : ''}`);
    }
  };

  check('post(s)', db.prepare('SELECT title FROM posts').all().map((r) => r.title),
    new Set(POSTS.map((p) => p.title)));
  check('kategorie(n)', db.prepare('SELECT name FROM categories').all().map((r) => r.name),
    new Set(CATEGORIES.map((c) => c.name)));
  check('splash(es)', db.prepare('SELECT text FROM splashes').all().map((r) => r.text),
    new Set(SPLASHES));
  check('shoutout(s)', db.prepare('SELECT creator FROM shoutouts').all().map((r) => r.creator),
    new Set(SHOUTOUTS.map((s) => s.creator)));
  check('kontaktlink(s)', db.prepare('SELECT label FROM links').all().map((r) => r.label),
    new Set());

  // geaenderte seitentexte zaehlen auch als eigene inhalte
  const pageBodies = new Set(PAGES.map((p) => p.body));
  const changed = db.prepare('SELECT slug, body FROM pages').all()
    .filter((r) => !pageBodies.has(r.body));
  if (changed.length) out.push(`${changed.length} geänderte seite(n): ${changed.map((c) => c.slug).join(', ')}`);

  return out;
}

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
const insertSplash = db.prepare('INSERT INTO splashes (text) VALUES (?)');
const insertShoutout = db.prepare(`
  INSERT INTO shoutouts (creator, title, kind, url, note, shouted_at)
  VALUES (@creator, @title, @kind, @url, @note, @date)
`);
const insertPage = db.prepare(`
  INSERT INTO pages (slug, title, body, layout, tab_group, position)
  VALUES (@slug, @title, @body, @layout, @tab_group, @position)
`);
const insertLink = db.prepare(
  'INSERT INTO links (page_slug, label, url, position) VALUES (?, ?, ?, ?)'
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

  SPLASHES.forEach((text) => insertSplash.run(text));
  SHOUTOUTS.forEach((so) => insertShoutout.run(so));

  PAGES.forEach((pg) => {
    insertPage.run({
      slug: pg.slug, title: pg.title, body: pg.body,
      layout: pg.layout, tab_group: pg.tab_group, position: pg.position,
    });
    (pg.links || []).forEach((l, i) => insertLink.run(pg.slug, l.label, l.url, i));
  });
})();

const linkCount = PAGES.reduce((n, p) => n + (p.links || []).length, 0);
console.log(`✓ ${CATEGORIES.length} kategorien, ${POSTS.length} posts, ${PAGES.length} seiten, ${linkCount} links, ${SPLASHES.length} splashes, ${SHOUTOUTS.length} shoutouts angelegt`);
