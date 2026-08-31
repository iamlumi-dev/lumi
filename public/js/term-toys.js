/*=== TERMINAL — spielereien ===*/
/* liegt bewusst neben terminal.js: das terminal selbst soll lesbar bleiben.
   jeder eintrag bekommt beim aufruf einen kontext mit den ausgabe-funktionen
   des terminals, damit hier nichts direkt am dom herumgreift. */
window.__termToys = (function () {
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  /* =====================================================================
     theme — hintergrund umschalten
     ===================================================================== */

  const theme = {
    describe: 'switch the background: wheat, roots, off',
    run(ctx, args) {
      const bg = window.__bg;
      if (!bg) return ctx.line('the background is not available here.', 'dim');

      const wanted = (args[0] || '').toLowerCase();
      if (!wanted) {
        ctx.line(`background: ${bg.current}`);
        ctx.line();
        for (const name of bg.available) {
          ctx.pair(name, name === bg.current ? '← current' : '');
        }
        ctx.line();
        ctx.line('usage: theme roots', 'dim');
        return;
      }

      if (!bg.available.includes(wanted)) {
        return ctx.line(`no such background: ${wanted} — try ${bg.available.join(', ')}`, 'dim');
      }
      bg.set(wanted);
      ctx.line(`background: ${wanted}`);
      if (wanted !== 'off') ctx.line('give it a moment to grow.', 'dim');
    },
  };

  /* =====================================================================
     matrix — zeichenregen im fenster
     ===================================================================== */

  const GLYPHS = 'abcdefghijklmnopqrstuvwxyz0123456789/\\|_-+*=<>[]{}()';

  const matrix = {
    describe: 'let it rain for a bit',
    run(ctx) {
      if (ctx.reduceMotion) {
        return ctx.line('not with reduced motion turned on. probably for the best.', 'dim');
      }

      const COLS = 46;
      const ROWS = 12;
      const DURATION = 8000;

      const screen = el('pre', 'term-rain');
      ctx.body.appendChild(screen);

      // je spalte ein tropfen mit eigener geschwindigkeit
      const drops = Array.from({ length: COLS }, () => ({
        y: Math.random() * -ROWS,
        speed: 0.3 + Math.random() * 0.7,
      }));

      let stop = null;
      const tick = () => {
        const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(' '));
        drops.forEach((drop, x) => {
          drop.y += drop.speed;
          if (drop.y - 6 > ROWS) { drop.y = -Math.random() * ROWS; drop.speed = 0.3 + Math.random() * 0.7; }
          // ein kopf und ein kurzer schweif dahinter
          for (let t = 0; t < 6; t++) {
            const y = Math.floor(drop.y) - t;
            if (y >= 0 && y < ROWS) grid[y][x] = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          }
        });
        screen.textContent = grid.map((r) => r.join('')).join('\n');
      };

      const timer = setInterval(tick, 90);
      tick();

      const end = () => {
        clearInterval(timer);
        clearTimeout(stop);
        screen.remove();
        ctx.line('rain stopped.', 'dim');
        ctx.scrollDown();
        document.removeEventListener('keydown', end);
      };
      stop = setTimeout(end, DURATION);
      document.addEventListener('keydown', end);

      ctx.line('any key to stop.', 'dim');
    },
  };

  /* =====================================================================
     plant — eine pflanze wächst zeile für zeile
     ===================================================================== */

  const plant = {
    describe: 'grow something',
    run(ctx) {
      // simpler wachstums-algorithmus: ein stamm, der abzweigungen setzt.
      // jede pflanze ist anders, weil der zufall pro aufruf neu läuft.
      const W = 27;
      const H = 11;
      const grid = Array.from({ length: H }, () => new Array(W).fill(' '));

      let x = Math.floor(W / 2);
      const branches = [];

      for (let y = H - 1; y >= 0; y--) {
        grid[y][x] = y === 0 ? '*' : '|';

        // der stamm wandert langsam
        if (Math.random() < 0.35) x = Math.max(1, Math.min(W - 2, x + (Math.random() < 0.5 ? -1 : 1)));

        // abzweigung, aber nicht ganz unten und nicht ganz oben
        if (y < H - 2 && y > 1 && Math.random() < 0.45) {
          branches.push({ x, y, dir: Math.random() < 0.5 ? -1 : 1, len: 2 + Math.floor(Math.random() * 4) });
        }
      }

      for (const b of branches) {
        let bx = b.x;
        let by = b.y;
        for (let i = 0; i < b.len; i++) {
          bx += b.dir;
          if (i % 2 === 1) by = Math.max(0, by - 1);
          if (bx <= 0 || bx >= W - 1 || by < 0) break;
          grid[by][bx] = b.dir < 0 ? '\\' : '/';
        }
        // blüte am ende
        if (bx > 0 && bx < W - 1 && by >= 0) grid[by][bx] = Math.random() < 0.5 ? ',' : '*';
      }

      grid[H - 1] = ('_'.repeat(W)).split('');
      grid[H - 1][x] = '|';

      const lines = grid.map((r) => r.join('').replace(/\s+$/, ''));

      if (ctx.reduceMotion) {
        lines.forEach((l) => ctx.line(l));
        return;
      }

      // von unten nach oben ausgeben, damit sie wirklich wächst
      const pre = el('pre', 'term-plant');
      ctx.body.appendChild(pre);
      let shown = 0;
      const timer = setInterval(() => {
        shown++;
        pre.textContent = lines.slice(lines.length - shown).join('\n');
        ctx.scrollDown();
        if (shown >= lines.length) clearInterval(timer);
      }, 110);
    },
  };

  /* =====================================================================
     glitch — der seitentext zerfällt kurz
     ===================================================================== */

  const glitch = {
    describe: 'briefly break the page',
    run(ctx) {
      if (ctx.reduceMotion) {
        return ctx.line('not with reduced motion turned on.', 'dim');
      }

      // nur der mittelteil der seite, nicht das terminal selbst — sonst
      // zerlegt es die eigene ausgabe
      const scope = document.getElementById('middleSection');
      if (!scope) return ctx.line('nothing here to break.', 'dim');

      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue.trim()) nodes.push({ node, original: node.nodeValue });
      }
      if (!nodes.length) return ctx.line('nothing here to break.', 'dim');

      const scramble = (text) => text.replace(/\S/g, () =>
        Math.random() < 0.55 ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : ' ');

      const timer = setInterval(() => {
        for (const n of nodes) n.node.nodeValue = scramble(n.original);
      }, 70);

      // egal was passiert, nach zwei sekunden steht der text wieder
      setTimeout(() => {
        clearInterval(timer);
        for (const n of nodes) n.node.nodeValue = n.original;
        ctx.line('put it back.', 'dim');
        ctx.scrollDown();
      }, 2000);

      ctx.line('oops.');
    },
  };

  /* =====================================================================
     cowsay — mit sprössling statt kuh
     ===================================================================== */

  const IDLE_LINES = [
    'i am a plant. i have no opinions.',
    'still unreleased.',
    'water me.',
    'photosynthesis is going fine, thanks.',
    'try: cowsay hello',
  ];

  const cowsay = {
    describe: 'say it, but botanically',
    run(ctx, args) {
      const text = args.join(' ').trim()
        || IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)];

      // in zeilen von höchstens 38 zeichen umbrechen, an wortgrenzen
      const WIDTH = 38;
      const lines = [];
      let current = '';
      for (const word of text.split(/\s+/)) {
        if (!current) current = word;
        else if ((current + ' ' + word).length <= WIDTH) current += ' ' + word;
        else { lines.push(current); current = word; }
      }
      if (current) lines.push(current);

      const width = Math.max(...lines.map((l) => l.length));
      const out = [];
      out.push(' ' + '_'.repeat(width + 2));
      if (lines.length === 1) {
        out.push(`< ${lines[0].padEnd(width)} >`);
      } else {
        lines.forEach((l, i) => {
          const left = i === 0 ? '/' : i === lines.length - 1 ? '\\' : '|';
          const right = i === 0 ? '\\' : i === lines.length - 1 ? '/' : '|';
          out.push(`${left} ${l.padEnd(width)} ${right}`);
        });
      }
      out.push(' ' + '-'.repeat(width + 2));
      out.push('        \\   \\   /');
      out.push('         \\   \\ /');
      out.push('           \\  |  /');
      out.push('            \\ | /');
      out.push('              |');
      out.push('            __|__');

      const pre = el('pre', 'term-plant');
      pre.textContent = out.join('\n');
      ctx.body.appendChild(pre);
    },
  };

  /* =====================================================================
     search / grep — posts und shoutouts durchsuchen
     ===================================================================== */

  const search = {
    describe: 'search everything',
    async run(ctx, args) {
      const term = args.join(' ').trim().toLowerCase();
      if (!term) {
        ctx.line('usage: search <word>', 'dim');
        return;
      }

      ctx.line(`searching for "${term}" …`, 'dim');

      try {
        const [posts, shouts] = await Promise.all([
          fetch('/api/posts').then((r) => r.json()),
          fetch('/api/shoutouts').then((r) => r.json()).catch(() => ({ shoutouts: [] })),
        ]);

        const hits = [];

        for (const p of posts.posts) {
          const haystack = [p.title, p.summary, p.body, ...p.categories.map((c) => c.name)]
            .join(' ').toLowerCase();
          if (haystack.includes(term)) {
            hits.push({ where: 'work', label: p.title, href: `/portfolio/${p.slug}` });
          }
        }

        for (const s of shouts.shoutouts || []) {
          const haystack = [s.creator, s.title, s.note, s.kind].join(' ').toLowerCase();
          if (haystack.includes(term)) {
            hits.push({
              where: 'shoutout',
              label: [s.creator, s.title].filter(Boolean).join(' — '),
              href: s.url || '/shoutouts/',
              external: !!s.url,
            });
          }
        }

        if (!hits.length) return ctx.line('nothing found.', 'dim');

        ctx.line(`${hits.length} result${hits.length === 1 ? '' : 's'}:`);
        for (const hit of hits) ctx.linkLine(hit.where, hit.label, hit.href, hit.external);
      } catch {
        ctx.line('search failed — try again.', 'dim');
      }
    },
  };

  /* =====================================================================
     random — irgendein post
     ===================================================================== */

  const random = {
    describe: 'open a random piece',
    async run(ctx) {
      try {
        const { posts } = await fetch('/api/posts').then((r) => r.json());
        if (!posts.length) return ctx.line('nothing here yet.', 'dim');
        const pick = posts[Math.floor(Math.random() * posts.length)];
        ctx.line(`→ ${pick.title}`);
        ctx.go(`/portfolio/${pick.slug}`);
      } catch {
        ctx.line('could not reach the shelf.', 'dim');
      }
    },
  };

  return {
    theme,
    matrix,
    plant,
    glitch,
    cowsay,
    search,
    random,
    // grep tut dasselbe wie search, steht aber nicht in help
    grep: { describe: '', hidden: true, run: search.run },
  };
})();
