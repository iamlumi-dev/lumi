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

  /* eigener audio-player: die nativen controls sind hellgrau-weiss und
     wuerden die monochrome palette sprengen. hier nur text und linien. */
  function audioPlayer(src) {
    const audio = el('audio');
    audio.src = src;
    audio.preload = 'metadata';

    const box = el('div', 'audio');
    const toggle = el('button', 'audio-toggle', 'play');
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'play');

    const seek = el('input');
    seek.type = 'range';
    seek.className = 'audio-seek';
    seek.min = 0; seek.max = 100; seek.step = 0.1; seek.value = 0;
    seek.setAttribute('aria-label', 'position');

    const time = el('span', 'audio-time', '0:00 / –:––');

    const fmt = (secs) => {
      if (!isFinite(secs)) return '–:––';
      const m = Math.floor(secs / 60);
      const s2 = Math.floor(secs % 60);
      return `${m}:${String(s2).padStart(2, '0')}`;
    };
    const sync = () => {
      time.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
    };

    toggle.addEventListener('click', () => {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    });
    audio.addEventListener('play', () => {
      toggle.textContent = 'pause';
      toggle.setAttribute('aria-label', 'pause');
    });
    audio.addEventListener('pause', () => {
      toggle.textContent = 'play';
      toggle.setAttribute('aria-label', 'play');
    });
    audio.addEventListener('ended', () => { seek.value = 0; sync(); });
    audio.addEventListener('loadedmetadata', sync);
    audio.addEventListener('timeupdate', () => {
      if (audio.duration) seek.value = (audio.currentTime / audio.duration) * 100;
      sync();
    });
    seek.addEventListener('input', () => {
      if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration;
    });

    box.append(toggle, seek, time, audio);
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
      fig.appendChild(audioPlayer(m.src));
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
