/*=== DETAILSEITE EINES POSTS ===*/
(function () {
  const wrap = document.getElementById('postWrap');

  // slug steckt im pfad: /portfolio/<slug>
  const slug = decodeURIComponent(location.pathname.replace(/\/+$/, '').split('/').pop());

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  // leerzeilen im body werden zu absaetzen — kein markdown, kein html von aussen
  function paragraphs(text) {
    const frag = document.createDocumentFragment();
    text.split(/\n\s*\n/).filter((s) => s.trim()).forEach((chunk) => {
      frag.appendChild(el('p', null, chunk.trim()));
    });
    return frag;
  }

  /* =====================================================================
     audio
     =====================================================================
     eigener player, weil die nativen controls hellgrau-weiss sind und die
     palette sprengen wuerden. dazu ein lebender visualizer nach dem vorbild
     von ferrofluid-displays: eine dunkle masse, aus der spitzen wachsen.

     die lautstaerke wird durch ziehen auf dem visualizer geregelt — hoch
     lauter, runter leiser. auf dem handy ist das deutlich angenehmer als
     ein schmaler regler.                                                  */

  function audioPlayer(src, startAt = null) {
    const audio = el('audio');
    audio.src = src;
    audio.preload = 'metadata';

    const box = el('div', 'audio');

    /* ---- visualizer ---- */
    const canvas = el('canvas', 'audio-viz');
    canvas.setAttribute('aria-hidden', 'true');
    const hint = el('div', 'audio-hint', 'drag up or down for volume');
    const volumeTag = el('div', 'audio-volume');
    const stage = el('div', 'audio-stage');
    stage.append(canvas, hint, volumeTag);
    box.appendChild(stage);

    /* ---- bedienung ---- */
    const toggle = el('button', 'audio-toggle', 'play');
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'play');

    const seek = el('input');
    seek.type = 'range';
    seek.className = 'audio-seek';
    seek.min = 0; seek.max = 100; seek.step = 0.1; seek.value = 0;
    seek.setAttribute('aria-label', 'position');

    const time = el('span', 'audio-time', '0:00 / –:––');

    // el() nimmt hier (tag, klasse, text) — keine kinder. die muessen
    // ausdruecklich angehaengt werden.
    const line = el('div', 'audio-line');
    line.append(toggle, seek, time);
    box.append(line, audio);

    /* ---- web audio, erst beim ersten abspielen ----
       ein AudioContext darf ohne zutun des nutzers nicht laufen, und ein
       MediaElementSource laesst sich nur einmal je element anlegen. */
    let graph = null;
    let volume = 0.8;
    audio.volume = volume;

    function ensureGraph() {
      if (graph) return graph;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      try {
        const ctx = new Ctx();
        const source = ctx.createMediaElementSource(audio);
        const gain = ctx.createGain();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(gain);
        gain.connect(analyser);
        analyser.connect(ctx.destination);

        // ab jetzt regelt der gain die lautstaerke, nicht mehr das element
        gain.gain.value = volume;
        audio.volume = 1;
        graph = { ctx, gain, analyser, data: new Uint8Array(analyser.frequencyBinCount) };
      } catch {
        graph = null;
      }
      return graph;
    }

    function setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      if (graph) graph.gain.gain.value = volume;
      else audio.volume = volume;
      volumeTag.textContent = `volume ${Math.round(volume * 100)}%`;
    }
    setVolume(volume);

    /* ---- zeichnen ---- */
    const viz = window.__viz.ferrofluid(canvas);
    const idle = new Uint8Array(64);
    let raf = null;

    function frame() {
      window.__viz.fit(canvas);
      let data = idle;
      let level = 0;
      if (graph) {
        graph.analyser.getByteFrequencyData(graph.data);
        data = graph.data;
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        level = sum / data.length / 255;
      }
      viz.draw(data, level);

      // im ruhezustand einmal nachzeichnen und dann aufhoeren
      if (!audio.paused) raf = requestAnimationFrame(frame);
      else raf = null;
    }

    function startDrawing() {
      if (raf === null) raf = requestAnimationFrame(frame);
    }

    /* ---- lautstaerke durch ziehen ---- */
    let drag = null;
    stage.addEventListener('pointerdown', (e) => {
      stage.setPointerCapture(e.pointerId);
      drag = { y: e.clientY, from: volume, moved: 0 };
      stage.classList.add('adjusting');
    });
    stage.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dy = drag.y - e.clientY;
      drag.moved = Math.max(drag.moved, Math.abs(dy));
      // die volle hoehe des feldes entspricht etwa dem ganzen bereich
      setVolume(drag.from + dy / stage.getBoundingClientRect().height);
    });
    const endDrag = (e) => {
      if (!drag) return;
      const wasClick = drag.moved < 5;
      drag = null;
      stage.classList.remove('adjusting');
      stage.releasePointerCapture?.(e.pointerId);
      // ohne bewegung war es ein klick — dann abspielen oder anhalten
      if (wasClick) toggle.click();
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    // tastatur: hoch und runter regeln ebenfalls
    stage.tabIndex = 0;
    stage.setAttribute('role', 'slider');
    stage.setAttribute('aria-label', 'volume');
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); setVolume(volume + 0.05); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setVolume(volume - 0.05); }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle.click(); }
    });

    /* ---- abspielen ---- */
    const sync = () => {
      time.textContent =
        `${window.__viz.formatTime(audio.currentTime)} / ${window.__viz.formatTime(audio.duration)}`;
    };

    toggle.addEventListener('click', () => {
      if (audio.paused) {
        ensureGraph();
        graph?.ctx.resume?.();
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    });

    audio.addEventListener('play', () => {
      toggle.textContent = 'pause';
      toggle.setAttribute('aria-label', 'pause');
      ensureGraph();
      startDrawing();
    });
    audio.addEventListener('pause', () => {
      toggle.textContent = 'play';
      toggle.setAttribute('aria-label', 'play');
    });
    audio.addEventListener('ended', () => { seek.value = 0; sync(); });
    audio.addEventListener('loadedmetadata', () => {
      sync();
      // sprungziel aus dem grid: ?t=… an der kachel angeklickt
      if (startAt !== null && isFinite(audio.duration)) {
        audio.currentTime = Math.min(startAt, audio.duration - 0.1);
        seek.value = (audio.currentTime / audio.duration) * 100;
        sync();
        // versuchen loszuspielen. blockt der browser das (kein zutun des
        // nutzers auf DIESER seite), bleibt es stehen — die stelle stimmt
        // trotzdem und ein druck auf play genuegt.
        ensureGraph();
        audio.play().then(startDrawing).catch(() => {});
      }
    });
    audio.addEventListener('timeupdate', () => {
      if (audio.duration) seek.value = (audio.currentTime / audio.duration) * 100;
      sync();
    });
    seek.addEventListener('input', () => {
      if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration;
    });

    // einmal zeichnen, damit auch vor dem ersten abspielen etwas dasteht
    requestAnimationFrame(() => { window.__viz.fit(canvas); viz.draw(idle, 0); });

    return box;
  }

  function mediaFigure(m) {
    const fig = el('figure');

    if (m.kind === 'image') {
      const img = el('img');
      img.src = m.src;
      img.alt = m.alt || '';
      img.loading = 'lazy';
      fig.appendChild(img);
    } else if (m.kind === 'video') {
      const v = el('video');
      v.src = m.src;
      if (m.poster) v.poster = m.poster;
      v.controls = true;
      v.playsInline = true;
      v.preload = 'metadata';
      fig.appendChild(v);
    } else if (m.kind === 'audio') {
      const t = Number(new URLSearchParams(location.search).get('t'));
      fig.appendChild(audioPlayer(m.src, isFinite(t) && t > 0 ? t : null));
    } else if (m.kind === 'youtube') {
      fig.appendChild(youtubeEmbed(m));
    }

    const caption = m.caption || m.alt;
    if (caption) fig.appendChild(el('figcaption', null, caption));
    return fig;
  }

  function render(post, prev, next) {
    document.title = `${post.title} ✧ lumis work`;
    wrap.replaceChildren();

    wrap.appendChild(el('h1', null, post.title));

    const date = post.publishedAt.slice(0, 10);
    wrap.appendChild(el('p', 'post-date', date));

    if (post.categories.length) {
      const cats = el('div', 'post-cats');
      for (const c of post.categories) {
        const a = el('a');
        a.href = `/portfolio/?c=${encodeURIComponent(c.slug)}`;
        a.appendChild(el('span', 'chip', c.name));
        cats.appendChild(a);
      }
      wrap.appendChild(cats);
    }

    if (post.summary) {
      const lead = el('p', 'lead', post.summary);
      wrap.appendChild(lead);
    }

    // medien in der reihenfolge, die im admin gesetzt wurde
    if (post.media.length) {
      const box = el('div', 'post-media');
      post.media.forEach((m) => box.appendChild(mediaFigure(m)));
      wrap.appendChild(box);
    }

    if (post.body) {
      const body = el('div', 'post-body');
      body.appendChild(paragraphs(post.body));
      wrap.appendChild(body);
    }

    const nav = el('nav', 'post-neighbours');
    if (prev) {
      const a = el('a', null, `← ${prev.title}`);
      a.href = `/portfolio/${prev.slug}`;
      nav.appendChild(a);
    } else nav.appendChild(el('span'));
    if (next) {
      const a = el('a', null, `${next.title} →`);
      a.href = `/portfolio/${next.slug}`;
      nav.appendChild(a);
    } else nav.appendChild(el('span'));
    wrap.appendChild(nav);
  }

  async function load() {
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(slug)}`);
      if (res.status === 404) {
        document.title = '404 ✧ lumis work';
        wrap.replaceChildren(el('h1', null, '404'), el('p', null, 'nothing grows here …'));
        return;
      }
      if (!res.ok) throw new Error('api');
      const data = await res.json();
      render(data.post, data.prev, data.next);
    } catch (err) {
      wrap.replaceChildren(el('p', null, 'could not load this piece … try reloading'));
      console.error(err);
    }
  }

  load();
})();
