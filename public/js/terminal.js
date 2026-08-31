/*=== TERMINAL ===*/
/* ein fenster unten links auf der startseite. eingeklappt ist es nur die
   zeile "made by lumi", ausgeklappt laesst es sich verschieben. jeder
   besucher darf es benutzen — es navigiert bloss, es kann nichts anrichten. */
(function () {
  const win = document.getElementById('term');
  const bar = document.getElementById('termBar');
  const body = document.getElementById('termBody');
  const form = document.getElementById('termForm');
  const inputEl = document.getElementById('termInput');
  const minBar = document.getElementById('termMin');
  const closeBtn = document.getElementById('termClose');
  if (!win) return;

  const POSITION_KEY = 'lw.term.pos';
  const started = Date.now();
  const history = [];
  let historyAt = 0;

  /* ---- ausgabe ------------------------------------------------------------ */

  function line(text = '', cls = '') {
    const div = document.createElement('div');
    div.className = `term-out${cls ? ' ' + cls : ''}`;
    div.textContent = text;
    body.appendChild(div);
    return div;
  }

  // zwei spalten, wie bei fastfetch
  function pair(key, value) {
    const div = document.createElement('div');
    div.className = 'term-out';
    const k = document.createElement('span');
    k.className = 'term-key';
    k.textContent = key;
    div.append(k, document.createTextNode(value));
    body.appendChild(div);
  }

  const scrollDown = () => { body.scrollTop = body.scrollHeight; };

  /* ---- fastfetch ---------------------------------------------------------- */

  // ein sprössling in ascii, links neben den angaben
  const LOGO = [
    '   \\   /   ',
    '    \\ /    ',
    '  \\  |  /  ',
    '   \\ | /   ',
    '     |     ',
    '     |     ',
    '  ___|___  ',
  ];

  function uptime() {
    const s = Math.max(1, Math.round((Date.now() - started) / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  // grobe einordnung des besuchenden systems — rein clientseitig, es wird
  // nichts davon irgendwohin geschickt
  function guessOs() {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Linux/i.test(ua)) return 'linux';
    if (/Mac OS X/i.test(ua)) return 'macos';
    if (/Windows/i.test(ua)) return 'windows';
    return 'unknown';
  }

  function guessBrowser() {
    const ua = navigator.userAgent;
    if (/Firefox\//.test(ua)) return 'firefox';
    if (/Edg\//.test(ua)) return 'edge';
    if (/OPR\//.test(ua)) return 'opera';
    if (/Chrome\//.test(ua)) return 'chromium';
    if (/Safari\//.test(ua)) return 'safari';
    return 'something';
  }

  // welcher hintergrund-sketch gerade laeuft
  function sketch() {
    const tag = [...document.scripts].map((s) => s.src).find((s) => /\/js\/(roots|wheat)\.js/.test(s));
    return tag ? tag.match(/\/js\/(\w+)\.js/)[1] : 'none';
  }

  let stats = { pieces: '…', tags: '…' };

  function fastfetch() {
    const rows = [
      ['host', 'lumiswork'],
      ['os', guessOs()],
      ['browser', guessBrowser()],
      ['shell', 'lumi-sh 1.0'],
      ['wm', sketch()],
      ['theme', 'terminal green'],
      ['pieces', String(stats.pieces)],
      ['tags', String(stats.tags)],
      ['uptime', uptime()],
    ];

    const block = document.createElement('div');
    block.className = 'term-fetch';

    const logo = document.createElement('pre');
    logo.className = 'term-logo';
    logo.textContent = LOGO.join('\n');

    const info = document.createElement('div');
    info.className = 'term-info';

    const title = document.createElement('div');
    title.className = 'term-out term-user';
    title.textContent = 'made by lumi';
    info.appendChild(title);

    const rule = document.createElement('div');
    rule.className = 'term-out';
    rule.textContent = '─'.repeat(24);
    info.appendChild(rule);

    for (const [k, v] of rows) {
      const row = document.createElement('div');
      row.className = 'term-out';
      const key = document.createElement('span');
      key.className = 'term-key';
      key.textContent = k;
      row.append(key, document.createTextNode(v));
      info.appendChild(row);
    }

    // die fuenf farben der seite als bloecke
    const colors = document.createElement('div');
    colors.className = 'term-out term-colors';
    for (const v of ['--bgclr', '--altbgclr', '--acntclr', '--titleclr', '--txtclr']) {
      const swatch = document.createElement('span');
      swatch.className = 'term-swatch';
      swatch.style.backgroundColor = `var(${v})`;
      colors.appendChild(swatch);
    }
    info.appendChild(colors);

    block.append(logo, info);
    body.appendChild(block);
  }

  /* ---- befehle ------------------------------------------------------------ */

  const go = (href) => {
    line(`opening ${href} …`);
    setTimeout(() => { location.href = href; }, 300);
  };

  // "hidden: true" heisst: laeuft, taucht aber in help nicht auf
  const COMMANDS = {
    help: {
      describe: 'this list',
      run() {
        line('commands:');
        for (const [name, cmd] of Object.entries(COMMANDS)) {
          if (cmd.hidden) continue;
          pair(name, cmd.describe);
        }
        line();
        line('drag the bar to move this window. — minimises it.', 'dim');
      },
    },
    work: { describe: 'the portfolio', run: () => go('/portfolio/') },
    about: { describe: 'who lumi is', run: () => go('/about/') },
    splash: {
      describe: 'roll another splash text',
      run() {
        window.__splash?.roll();
        line(document.getElementById('splash')?.textContent.trim() || '…');
      },
    },
    fetch: { describe: 'system information, allegedly', run: fastfetch },
    clear: { describe: 'wipe the screen', run: () => body.replaceChildren() },
    exit: { describe: 'minimise the window', run: () => setOpen(false) },

    // aliase und verstecktes
    portfolio: { describe: '', hidden: true, run: () => go('/portfolio/') },
    whoami: { describe: '', hidden: true, run: () => go('/about/') },
    home: { describe: '', hidden: true, run: () => go('/') },
    fastfetch: { describe: '', hidden: true, run: fastfetch },
    neofetch: { describe: '', hidden: true, run: fastfetch },
    login: { describe: '', hidden: true, run: () => go('/login/') },
    ls: { describe: '', hidden: true, run: () => line('work  about  splash') },
    sudo: { describe: '', hidden: true, run: () => line('lumi is not in the sudoers file. this incident will be reported.') },
    help2: { describe: '', hidden: true, run: () => COMMANDS.help.run() },
  };

  function execute(raw) {
    const text = raw.trim();
    line(`$ ${text}`, 'term-echo');
    if (!text) return;

    history.push(text);
    historyAt = history.length;

    const name = text.split(/\s+/)[0].toLowerCase();
    const cmd = COMMANDS[name];
    if (cmd) cmd.run();
    else line(`command not found: ${name} — try help`, 'dim');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    execute(inputEl.value);
    inputEl.value = '';
    scrollDown();
  });

  // pfeiltasten blaettern durch die eingaben
  inputEl.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    if (!history.length) return;
    e.preventDefault();
    historyAt = Math.min(history.length, Math.max(0, historyAt + (e.key === 'ArrowUp' ? -1 : 1)));
    inputEl.value = history[historyAt] ?? '';
  });

  // klick irgendwo ins fenster setzt den cursor in die eingabe
  body.addEventListener('click', () => {
    if (!window.getSelection()?.toString()) inputEl.focus();
  });

  /* ---- auf- und zuklappen -------------------------------------------------- */

  let opened = false;

  function setOpen(open) {
    opened = open;
    win.hidden = !open;
    minBar.hidden = open;
    if (!open) return;

    const firstTime = !body.childElementCount;
    if (firstTime) {
      fastfetch();
      line();
      line('type help for the list of commands.', 'dim');
    }
    restorePosition();
    inputEl.focus();
    // beim ersten oeffnen oben anfangen, sonst waere die kopfzeile der
    // fastfetch-ausgabe schon weggescrollt
    if (firstTime) body.scrollTop = 0;
    else scrollDown();
  }

  minBar.addEventListener('click', () => setOpen(true));
  closeBtn.addEventListener('click', () => setOpen(false));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && opened) setOpen(false);
  });

  /* ---- verschieben --------------------------------------------------------- */

  let drag = null;

  function clampInto(left, top) {
    const rect = win.getBoundingClientRect();
    return {
      left: Math.min(Math.max(0, left), Math.max(0, window.innerWidth - rect.width)),
      top: Math.min(Math.max(0, top), Math.max(0, window.innerHeight - rect.height)),
    };
  }

  function place(left, top) {
    const safe = clampInto(left, top);
    win.style.left = `${safe.left}px`;
    win.style.top = `${safe.top}px`;
    win.style.right = 'auto';
    win.style.bottom = 'auto';
  }

  bar.addEventListener('pointerdown', (e) => {
    // der minimieren-knopf sitzt in der leiste und soll nicht ziehen
    if (e.target.closest('.term-btn')) return;
    const rect = win.getBoundingClientRect();
    drag = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    bar.setPointerCapture(e.pointerId);
    win.classList.add('dragging');
  });

  bar.addEventListener('pointermove', (e) => {
    if (!drag) return;
    place(e.clientX - drag.dx, e.clientY - drag.dy);
  });

  const endDrag = (e) => {
    if (!drag) return;
    drag = null;
    win.classList.remove('dragging');
    bar.releasePointerCapture?.(e.pointerId);
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify({ left: win.offsetLeft, top: win.offsetTop }));
    } catch { /* privater modus, dann eben nicht */ }
  };
  bar.addEventListener('pointerup', endDrag);
  bar.addEventListener('pointercancel', endDrag);

  function restorePosition() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(POSITION_KEY) || 'null'); } catch { /* egal */ }
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) place(saved.left, saved.top);
  }

  // fenster kleiner gezogen? das terminal darf nicht draussen liegen bleiben
  window.addEventListener('resize', () => {
    if (opened && win.style.left) place(win.offsetLeft, win.offsetTop);
  });

  /* ---- zahlen fuer fastfetch ----------------------------------------------- */

  Promise.all([
    fetch('/api/posts').then((r) => r.json()).catch(() => null),
    fetch('/api/categories').then((r) => r.json()).catch(() => null),
  ]).then(([posts, cats]) => {
    stats = {
      pieces: posts?.posts?.length ?? '?',
      tags: cats?.categories?.length ?? '?',
    };
  });
})();
