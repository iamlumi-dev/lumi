/*=== EDITOR ===*/
/* eine seite, mehrere abschnitte. jeder abschnitt ist ein objekt mit einer
   render-funktion — ein neuer inhaltstyp braucht also nur einen eintrag in
   SECTIONS und einen knopf in der kopfleiste. */
(function () {
  const panel = document.getElementById('panel');
  const nav = document.getElementById('sections');
  const toastEl = document.getElementById('toast');

  let csrf = null;

  /* ---- kleine helfer ----------------------------------------------------- */

  function el(tag, props = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') throw new Error('kein innerHTML im editor');
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, '');
      else if (v !== false && v !== null && v !== undefined) n.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c) n.appendChild(c);
    return n;
  }

  let toastTimer;
  function toast(message, bad = false) {
    toastEl.textContent = message;
    toastEl.classList.toggle('bad', bad);
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  // jede schreibende anfrage traegt das csrf-token der session
  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'X-CSRF-Token': csrf } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      location.href = '/login/';
      throw new Error('abgemeldet');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `fehler ${res.status}`);
    return data;
  }

  // wrapper, der fehler als toast zeigt statt die seite still stehen zu lassen
  const guard = (fn) => async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      toast(err.message, true);
      console.error(err);
    }
  };

  function field(label, input, wide = false) {
    return el('label', { class: `field${wide ? ' wide-field' : ''}` },
      [el('span', { text: label }), input]);
  }

  function input(name, value, attrs = {}) {
    return el('input', { type: 'text', name, value: value ?? '', ...attrs });
  }

  // ein textfeld, das mit seinem inhalt mitwaechst, statt eine bildlaufleiste
  // zu bekommen — gebraucht dort, wo enter erlaubt ist, die zeilen aber
  // meistens kurz bleiben.
  function grow(node) {
    const fit = () => {
      node.style.height = 'auto';
      node.style.height = `${node.scrollHeight}px`;
    };
    node.addEventListener('input', fit);
    // beim ersten anzeigen ist die hoehe noch nicht messbar
    requestAnimationFrame(fit);
    return node;
  }

  function textarea(name, value, rows = 6) {
    const t = el('textarea', { name, rows });
    t.value = value ?? '';
    return t;
  }

  function select(name, options, value) {
    const s = el('select', { name });
    for (const o of options) {
      const opt = el('option', { value: o.value, text: o.label });
      if (o.value === value) opt.selected = true;
      s.appendChild(opt);
    }
    return s;
  }

  function checkbox(name, label, checked) {
    const box = el('input', { type: 'checkbox', name });
    box.checked = !!checked;
    return el('label', { class: 'check' }, [box, el('span', { text: label })]);
  }

  const val = (form, name) => form.querySelector(`[name="${name}"]`).value;
  const checked = (form, name) => form.querySelector(`[name="${name}"]`).checked;

  function confirmed(question) {
    return window.confirm(question);
  }

  /* =====================================================================
     abschnitt: posts
     ===================================================================== */

  const POSTS = {
    title: 'posts',
    async render(into) {
      const [{ posts, sizes }, { categories }] = await Promise.all([
        api('/admin/posts'), api('/admin/categories'),
      ]);

      into.appendChild(el('h2', { text: 'posts' }));
      into.appendChild(el('div', { class: 'toolbar' }, [
        el('button', { type: 'button', class: 'roomy', text: 'new post',
          onclick: () => openPost(null, sizes, categories) }),
        el('span', { class: 'dim', text: `${posts.length} total, ${posts.filter(p => p.published).length} published` }),
      ]));

      if (!posts.length) {
        into.appendChild(el('p', { class: 'dim', text: 'nothing yet.' }));
        return;
      }

      const rows = el('div', { class: 'rows' });
      for (const post of posts) {
        const names = post.categories
          .map((id) => categories.find((c) => c.id === id)?.name)
          .filter(Boolean).join(' / ');

        rows.appendChild(el('div', { class: `row${post.published ? '' : ' muted'}` }, [
          el('div', { class: 'row-main' }, [
            el('div', { class: 'row-title', text: post.title }),
            el('div', { class: 'row-sub', text:
              [post.size,
               post.published ? 'published' : 'draft',
               post.pinned ? 'pinned' : null,
               `${post.mediaCount} media`,
               post.publishedAt.slice(0, 10),
               names || 'no category'].filter(Boolean).join('  ·  ') }),
          ]),
          el('div', { class: 'row-actions' }, [
            el('button', { type: 'button', class: 'mini', text: 'edit',
              onclick: () => openPost(post.id, sizes, categories) }),
            el('button', { type: 'button', class: 'mini', text: 'view',
              onclick: () => window.open(`/portfolio/${post.slug}`, '_blank', 'noopener') }),
          ]),
        ]));
      }
      into.appendChild(rows);
    },
  };

  const openPost = guard(async (id, sizes, categories) => {
    const post = id
      ? (await api(`/admin/posts/${id}`)).post
      : { title: '', slug: '', summary: '', body: '', size: 'small', pinned: false,
          published: false, publishedAt: new Date().toISOString().slice(0, 10),
          categories: [], media: [] };

    panel.replaceChildren();
    panel.appendChild(el('h2', { text: id ? `edit — ${post.title}` : 'new post' }));

    const form = el('form', { class: 'editor-form form' });

    form.appendChild(field('title', input('title', post.title, { required: true, maxlength: 200 }), true));
    form.appendChild(field('slug (url) — leave empty to derive from the title',
      input('slug', post.slug, { maxlength: 80, placeholder: 'auto' })));
    form.appendChild(field('date', input('publishedAt', post.publishedAt.slice(0, 10), { type: 'date' })));
    form.appendChild(field('summary — the text on the tile',
      textarea('summary', post.summary, 2), true));
    form.appendChild(field('body — the text on the detail page. blank line = new paragraph',
      textarea('body', post.body, 8), true));
    form.appendChild(field('tile size', select('size',
      sizes.map((s) => ({ value: s, label: s })), post.size)));

    // kategorien als umschaltbare chips
    const picked = new Set(post.categories);
    const pick = el('div', { class: 'pick' });
    for (const cat of categories) {
      const chip = el('button', { type: 'button', class: 'chip', text: cat.name });
      const sync = () => chip.setAttribute('aria-pressed', String(picked.has(cat.id)));
      chip.addEventListener('click', () => {
        picked.has(cat.id) ? picked.delete(cat.id) : picked.add(cat.id);
        sync();
      });
      sync();
      pick.appendChild(chip);
    }
    form.appendChild(field('categories', pick, true));

    form.appendChild(el('div', { class: 'form-row wide-field' }, [
      checkbox('published', 'published — visible to everyone', post.published),
      checkbox('pinned', 'pinned — first in the grid', post.pinned),
    ]));

    const actions = el('div', { class: 'form-actions' }, [
      el('button', { type: 'submit', class: 'roomy', text: id ? 'save' : 'create' }),
      el('button', { type: 'button', class: 'roomy', text: 'back to list', onclick: () => show('posts') }),
      el('div', { class: 'spacer' }),
    ]);
    if (id) {
      actions.appendChild(el('button', {
        type: 'button', class: 'roomy', text: 'delete post',
        onclick: guard(async () => {
          if (!confirmed(`delete "${post.title}" and all its media? this cannot be undone.`)) return;
          await api(`/admin/posts/${id}`, { method: 'DELETE' });
          toast('post deleted');
          show('posts');
        }),
      }));
    }
    form.appendChild(actions);

    form.addEventListener('submit', guard(async (e) => {
      e.preventDefault();
      const payload = {
        title: val(form, 'title'),
        slug: val(form, 'slug'),
        summary: val(form, 'summary'),
        body: val(form, 'body'),
        size: val(form, 'size'),
        publishedAt: val(form, 'publishedAt'),
        published: checked(form, 'published'),
        pinned: checked(form, 'pinned'),
        categories: [...picked],
      };
      const res = id
        ? await api(`/admin/posts/${id}`, { method: 'PATCH', body: payload })
        : await api('/admin/posts', { method: 'POST', body: payload });
      toast('saved');
      // nach dem anlegen direkt in den bearbeiten-modus, damit medien dazu koennen
      if (!id) openPost(res.post.id, sizes, categories);
    }));

    panel.appendChild(form);

    if (id) {
      panel.appendChild(el('h3', { text: 'media' }));
      panel.appendChild(mediaSection(id, post.media));
    } else {
      panel.appendChild(el('p', { class: 'dim', text: 'save the post first, then media can be added.' }));
    }
  });

  /* ---- medien ------------------------------------------------------------ */

  function mediaSection(postId, media) {
    const box = el('div');
    const list = el('div', { class: 'rows' });

    const refresh = guard(async () => {
      const fresh = (await api(`/admin/posts/${postId}`)).post.media;
      list.replaceChildren(...fresh.map((m, i) => mediaRow(postId, m, i, fresh, refresh)));
      if (!fresh.length) list.appendChild(el('p', { class: 'dim', text: 'no media. text-only posts are fine too.' }));
    });

    list.replaceChildren(...media.map((m, i) => mediaRow(postId, m, i, media, refresh)));
    if (!media.length) list.appendChild(el('p', { class: 'dim', text: 'no media. text-only posts are fine too.' }));

    box.appendChild(list);
    box.appendChild(uploadBox(postId, refresh));
    box.appendChild(youtubeBox(postId, refresh));
    return box;
  }

  function mediaRow(postId, m, index, all, refresh) {
    // vorschau: bilder direkt, alles andere als beschriftung
    const thumb = m.kind === 'image'
      ? el('img', { class: 'media-thumb', src: m.src, alt: '' })
      : m.kind === 'youtube'
        ? el('img', { class: 'media-thumb', src: `https://i.ytimg.com/vi/${m.src}/default.jpg`, alt: '' })
        : el('div', { class: 'media-thumb', text: m.kind });

    const alt = input('alt', m.alt, { placeholder: 'alt text' });
    const caption = input('caption', m.caption, { placeholder: 'caption' });

    const save = guard(async () => {
      await api(`/admin/media/${m.id}`, {
        method: 'PATCH',
        body: { alt: alt.value, caption: caption.value, isCover: m.isCover },
      });
      toast('media saved');
    });
    alt.addEventListener('change', save);
    caption.addEventListener('change', save);

    const move = guard(async (delta) => {
      const ids = all.map((x) => x.id);
      const to = index + delta;
      if (to < 0 || to >= ids.length) return;
      [ids[index], ids[to]] = [ids[to], ids[index]];
      await api(`/admin/posts/${postId}/media/order`, { method: 'POST', body: { ids } });
      refresh();
    });

    return el('div', { class: 'media-row' }, [
      thumb,
      el('div', { class: 'media-fields' }, [
        el('div', { class: 'row-sub', text: `${m.kind}  ·  ${m.src}` }),
        alt,
        caption,
      ]),
      el('div', { class: 'media-side' }, [
        el('button', { type: 'button', class: 'mini',
          text: m.isCover ? 'cover ✓' : 'make cover',
          onclick: guard(async () => {
            await api(`/admin/media/${m.id}`, {
              method: 'PATCH', body: { alt: alt.value, caption: caption.value, isCover: true },
            });
            toast('cover set');
            refresh();
          }) }),
        el('div', { class: 'row-actions' }, [
          el('button', { type: 'button', class: 'mini', text: '↑', title: 'move up',
            onclick: () => move(-1) }),
          el('button', { type: 'button', class: 'mini', text: '↓', title: 'move down',
            onclick: () => move(1) }),
          el('button', { type: 'button', class: 'mini', text: 'remove',
            onclick: guard(async () => {
              if (!confirmed('remove this media and delete the file?')) return;
              await api(`/admin/media/${m.id}`, { method: 'DELETE' });
              toast('removed');
              refresh();
            }) }),
        ]),
      ]),
    ]);
  }

  /* ---- upload mit fortschritt -------------------------------------------- */

  function uploadBox(postId, refresh) {
    const box = el('div');
    const uploads = el('div', { class: 'uploads' });

    const picker = el('input', { type: 'file', multiple: true, hidden: true });
    const drop = el('div', { class: 'drop', text: 'drop files here, or click to choose — several at once is fine' });

    drop.addEventListener('click', () => picker.click());
    picker.addEventListener('change', () => { queue([...picker.files]); picker.value = ''; });

    for (const evt of ['dragenter', 'dragover']) {
      drop.addEventListener(evt, (e) => { e.preventDefault(); drop.classList.add('over'); });
    }
    for (const evt of ['dragleave', 'drop']) {
      drop.addEventListener(evt, (e) => { e.preventDefault(); drop.classList.remove('over'); });
    }
    drop.addEventListener('drop', (e) => queue([...(e.dataTransfer?.files || [])]));

    // eine datei pro anfrage — nur so hat jede ihren eigenen fortschritt
    async function queue(files) {
      for (const file of files) await one(file);
      refresh();
    }

    function one(file) {
      const bar = el('i');
      const state = el('span', { class: 'upload-state', text: '0%' });
      uploads.appendChild(el('div', { class: 'upload' }, [
        el('span', { class: 'upload-name', text: file.name }),
        el('div', { class: 'bar' }, [bar]),
        state,
      ]));

      return new Promise((resolve) => {
        // fetch kennt keinen upload-fortschritt, XHR schon
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/admin/upload');
        xhr.setRequestHeader('X-CSRF-Token', csrf);

        xhr.upload.addEventListener('progress', (e) => {
          if (!e.lengthComputable) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          bar.style.width = `${pct}%`;
          state.textContent = `${pct}%`;
        });

        xhr.addEventListener('load', async () => {
          let data = {};
          try { data = JSON.parse(xhr.responseText); } catch { /* egal */ }

          if (xhr.status !== 201) {
            state.textContent = data.error || `failed (${xhr.status})`;
            bar.style.width = '0%';
            return resolve();
          }

          // datei liegt, jetzt als medium an den post haengen
          try {
            await api(`/admin/posts/${postId}/media`, {
              method: 'POST',
              body: { kind: data.kind, src: data.src, alt: '', caption: '' },
            });
            state.textContent = 'done';
          } catch (err) {
            state.textContent = err.message;
          }
          resolve();
        });

        xhr.addEventListener('error', () => { state.textContent = 'failed'; resolve(); });

        const fd = new FormData();
        fd.append('file', file);
        xhr.send(fd);
      });
    }

    box.appendChild(el('h3', { text: 'upload' }));
    box.appendChild(drop);
    box.appendChild(picker);
    box.appendChild(uploads);
    box.appendChild(el('p', { class: 'row-sub', id: 'uploadLimit', text: '' }));

    api('/admin/upload/limits').then(({ maxUploadMb }) => {
      box.querySelector('#uploadLimit').textContent = maxUploadMb > 0
        ? `up to ${maxUploadMb} MB per file. images, video and audio — no svg.`
        : 'no size limit set. images, video and audio — no svg.';
    }).catch(() => {});

    return box;
  }

  function youtubeBox(postId, refresh) {
    const url = input('yt', '', { placeholder: 'https://youtu.be/… or the video id' });
    const add = el('button', { type: 'button', class: 'roomy', text: 'add',
      onclick: guard(async () => {
        if (!url.value.trim()) return;
        await api(`/admin/posts/${postId}/media`, {
          method: 'POST', body: { kind: 'youtube', src: url.value, alt: '', caption: '' },
        });
        url.value = '';
        toast('youtube video added');
        refresh();
      }) });

    return el('div', {}, [
      el('h3', { text: 'youtube' }),
      el('div', { class: 'form-row' }, [url, add]),
      el('p', { class: 'row-sub', text: 'only the video id is stored. the player loads after a click, not before.' }),
    ]);
  }

  /* =====================================================================
     abschnitt: kategorien
     ===================================================================== */

  const CATEGORIES = {
    title: 'categories',
    async render(into) {
      const { categories } = await api('/admin/categories');
      into.appendChild(el('h2', { text: 'categories' }));
      into.appendChild(el('p', { class: 'dim', text: 'these are the filter chips on the portfolio page. the order here is the order there.' }));

      const rows = el('div', { class: 'rows' });
      categories.forEach((cat, i) => {
        const name = input('name', cat.name, { maxlength: 60 });
        const desc = input('description', cat.description, { placeholder: 'description (tooltip)', maxlength: 200 });

        const save = guard(async () => {
          await api(`/admin/categories/${cat.id}`, {
            method: 'PATCH', body: { name: name.value, description: desc.value },
          });
          toast('saved');
        });
        name.addEventListener('change', save);
        desc.addEventListener('change', save);

        const move = guard(async (delta) => {
          const ids = categories.map((c) => c.id);
          const to = i + delta;
          if (to < 0 || to >= ids.length) return;
          [ids[i], ids[to]] = [ids[to], ids[i]];
          await api('/admin/categories/order', { method: 'POST', body: { ids } });
          show('categories');
        });

        rows.appendChild(el('div', { class: 'row' }, [
          el('div', { class: 'media-fields' }, [name, desc]),
          el('span', { class: 'row-sub', text: `/${cat.slug}  ·  ${cat.count} posts` }),
          el('div', { class: 'row-actions' }, [
            el('button', { type: 'button', class: 'mini', text: '↑', onclick: () => move(-1) }),
            el('button', { type: 'button', class: 'mini', text: '↓', onclick: () => move(1) }),
            el('button', { type: 'button', class: 'mini', text: 'delete',
              onclick: guard(async () => {
                if (!confirmed(`delete "${cat.name}"? posts keep existing, they just lose this tag.`)) return;
                await api(`/admin/categories/${cat.id}`, { method: 'DELETE' });
                toast('deleted');
                show('categories');
              }) }),
          ]),
        ]));
      });
      into.appendChild(rows);

      const fresh = input('newCategory', '', { placeholder: 'new category' });
      into.appendChild(el('h3', { text: 'add' }));
      into.appendChild(el('div', { class: 'form-row' }, [
        fresh,
        el('button', { type: 'button', class: 'roomy', text: 'add',
          onclick: guard(async () => {
            if (!fresh.value.trim()) return;
            await api('/admin/categories', { method: 'POST', body: { name: fresh.value, description: '' } });
            toast('added');
            show('categories');
          }) }),
      ]));
    },
  };

  /* =====================================================================
     abschnitt: shoutouts
     ===================================================================== */

  const SHOUTOUTS = {
    title: 'shoutouts',
    async render(into) {
      const { shoutouts, kinds } = await api('/admin/shoutouts');

      into.appendChild(el('h2', { text: 'shoutouts' }));
      into.appendChild(el('p', { class: 'dim', text: 'things other people made. only the name is required — link, title, note and cover are all optional. a youtube link brings its own thumbnail.' }));

      // anlegen steht oben, wie bei den splashes
      into.appendChild(shoutoutForm(null, kinds));

      into.appendChild(el('h3', { text: `${shoutouts.length} entries` }));
      const rows = el('div', { class: 'rows' });
      for (const so of shoutouts) {
        rows.appendChild(el('div', { class: `row${so.published ? '' : ' muted'}` }, [
          thumbFor(so),
          el('div', { class: 'row-main' }, [
            el('div', { class: 'row-title', text: [so.creator, so.title].filter(Boolean).join(' — ') }),
            el('div', { class: 'row-sub', text:
              [so.kind, so.shouted_at, so.published ? null : 'hidden', so.url || 'no link']
                .filter(Boolean).join('  ·  ') }),
            so.note ? el('div', { class: 'row-sub', text: so.note }) : null,
          ]),
          el('div', { class: 'row-actions' }, [
            el('button', { type: 'button', class: 'mini', text: 'edit',
              onclick: () => openShoutout(so, kinds) }),
            el('button', { type: 'button', class: 'mini', text: 'delete',
              onclick: guard(async () => {
                if (!confirmed(`delete the shoutout for "${so.creator}"?`)) return;
                await api(`/admin/shoutouts/${so.id}`, { method: 'DELETE' });
                toast('deleted');
                show('shoutouts');
              }) }),
          ]),
        ]));
      }
      into.appendChild(rows);
    },
  };

  function thumbFor(so) {
    const src = so.cover || (so.youtube ? `https://i.ytimg.com/vi/${so.youtube}/default.jpg` : null);
    return src
      ? el('img', { class: 'media-thumb shout-thumb', src, alt: '' })
      : el('div', { class: 'media-thumb shout-thumb', text: so.kind });
  }

  const openShoutout = guard((so, kinds) => {
    panel.replaceChildren();
    panel.appendChild(el('h2', { text: `edit — ${so.creator}` }));
    panel.appendChild(shoutoutForm(so, kinds));
    panel.appendChild(el('div', { class: 'toolbar' }, [
      el('button', { type: 'button', class: 'roomy', text: 'back to list',
        onclick: () => show('shoutouts') }),
    ]));
  });

  // dasselbe formular fuers anlegen und fuers bearbeiten
  function shoutoutForm(so, kinds) {
    const isNew = !so;
    const data = so || { creator: '', title: '', kind: 'song', url: '', note: '',
                         cover: null, published: true, shouted_at: new Date().toISOString().slice(0, 10) };

    const form = el('form', { class: 'editor-form form' });

    form.appendChild(field('who — artist, band, person', input('creator', data.creator, { required: true, maxlength: 120 })));
    form.appendChild(field('what — track, record, … (optional)', input('title', data.title, { maxlength: 200 })));
    form.appendChild(field('kind', select('kind', kinds.map((k) => ({ value: k, label: k })), data.kind)));
    form.appendChild(field('date', input('date', (data.shouted_at || '').slice(0, 10), { type: 'date' })));
    form.appendChild(field('link (optional) — a youtube link also supplies the thumbnail',
      input('url', data.url, { maxlength: 2000, placeholder: 'https://…' }), true));
    form.appendChild(field('why you like it (optional)', textarea('note', data.note, 3), true));

    // cover: entweder hochladen oder das youtube-bild nehmen
    let cover = data.cover || null;
    const preview = el('div', { class: 'media-thumb shout-thumb' });
    const paintPreview = () => {
      preview.replaceChildren();
      if (cover) {
        const img = el('img', { src: cover, alt: '' });
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        preview.appendChild(img);
      } else {
        preview.textContent = 'no cover';
      }
    };
    paintPreview();

    const picker = el('input', { type: 'file', accept: 'image/*', hidden: true });
    picker.addEventListener('change', guard(async () => {
      const file = picker.files?.[0];
      picker.value = '';
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload', {
        method: 'POST', headers: { 'X-CSRF-Token': csrf }, body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'upload failed');
      cover = body.src;
      paintPreview();
      toast('cover uploaded — remember to save');
    }));

    form.appendChild(field('cover (optional)', el('div', { class: 'form-row' }, [
      preview,
      el('button', { type: 'button', class: 'roomy', text: 'choose image', onclick: () => picker.click() }),
      el('button', { type: 'button', class: 'roomy', text: 'remove',
        onclick: () => { cover = null; paintPreview(); toast('cover cleared — remember to save'); } }),
      picker,
    ]), true));

    form.appendChild(el('div', { class: 'form-row wide-field' }, [
      checkbox('published', 'visible on the page', data.published),
    ]));

    form.appendChild(el('div', { class: 'form-actions' }, [
      el('button', { type: 'submit', class: 'roomy', text: isNew ? 'add' : 'save' }),
    ]));

    form.addEventListener('submit', guard(async (e) => {
      e.preventDefault();
      const payload = {
        creator: val(form, 'creator'),
        title: val(form, 'title'),
        kind: val(form, 'kind'),
        url: val(form, 'url'),
        note: val(form, 'note'),
        cover,
        published: checked(form, 'published'),
        date: val(form, 'date'),
      };
      if (isNew) await api('/admin/shoutouts', { method: 'POST', body: payload });
      else await api(`/admin/shoutouts/${so.id}`, { method: 'PATCH', body: payload });
      toast(isNew ? 'added' : 'saved');
      show('shoutouts');
    }));

    return form;
  }

  /* =====================================================================
     abschnitt: seiten (about)
     ===================================================================== */

  const PAGES = {
    title: 'about',
    async render(into) {
      const { pages } = await api('/admin/pages');
      into.appendChild(el('h2', { text: 'pages' }));
      into.appendChild(el('p', { class: 'dim', text: 'free text on the site. entries sharing a group are the tabs of one page; position decides their order.' }));

      // nach gruppe sortiert ausgeben, damit klar ist, was wo landet
      const groups = new Map();
      for (const page of pages) {
        const key = page.tab_group || '(standalone)';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(page);
      }

      for (const [group, entries] of groups) {
        into.appendChild(el('h2', { text: group === 'about' ? 'about page — tabs' : group }));
        for (const page of entries) await renderPage(into, page);
      }
    },
  };

  // ein bearbeitungsformular fuer eine seite, dahinter bei layout "links"
  // noch die linkliste
  async function renderPage(into, page) {
    {
        const form = el('form', { class: 'editor-form form' });
        into.appendChild(el('h3', { text: `${page.title}  ·  /${page.slug}` }));

        form.appendChild(field('tab label', input('title', page.title, { required: true, maxlength: 80 })));
        form.appendChild(field('position', input('position', page.position, { type: 'number', min: 0, max: 999 })));
        form.appendChild(field('layout', select('layout', [
          { value: 'prose', label: 'prose — blank line = new paragraph, "## text" = subheading' },
          { value: 'list', label: 'list — "group:" opens a group, "key: value" a labelled row' },
          { value: 'links', label: 'links — text plus the link list below' },
        ], page.layout), true));
        form.appendChild(field('text', textarea('body', page.body, 10), true));
        form.appendChild(el('div', { class: 'form-actions' }, [
          el('button', { type: 'submit', class: 'roomy', text: 'save' }),
        ]));

        form.addEventListener('submit', guard(async (e) => {
          e.preventDefault();
          await api(`/admin/pages/${page.slug}`, {
            method: 'PATCH',
            body: {
              title: val(form, 'title'),
              body: val(form, 'body'),
              layout: val(form, 'layout'),
              position: Number(val(form, 'position')),
            },
          });
          toast('saved');
        }));
        into.appendChild(form);

        if (page.layout === 'links') into.appendChild(await linksBox(page.slug));
    }
  }

  async function linksBox(slug) {
    const box = el('div');
    const { links } = await api(`/admin/pages/${slug}/links`);

    const rows = el('div', { class: 'rows' });
    links.forEach((link, i) => {
      const label = input('label', link.label, { maxlength: 60 });
      const address = input('url', link.url, { maxlength: 2000 });
      const note = input('note', link.note, { placeholder: 'one line about it (optional)', maxlength: 200 });

      const save = guard(async () => {
        await api(`/admin/links/${link.id}`, {
          method: 'PATCH', body: { label: label.value, url: address.value, note: note.value },
        });
        toast('link saved');
      });
      [label, address, note].forEach((f) => f.addEventListener('change', save));

      const move = guard(async (delta) => {
        const ids = links.map((l) => l.id);
        const to = i + delta;
        if (to < 0 || to >= ids.length) return;
        [ids[i], ids[to]] = [ids[to], ids[i]];
        await api(`/admin/pages/${slug}/links/order`, { method: 'POST', body: { ids } });
        show('pages');
      });

      rows.appendChild(el('div', { class: 'row' }, [
        el('div', { class: 'media-fields' }, [label, address, note]),
        el('div', { class: 'row-actions' }, [
          el('button', { type: 'button', class: 'mini', text: '↑', onclick: () => move(-1) }),
          el('button', { type: 'button', class: 'mini', text: '↓', onclick: () => move(1) }),
          el('button', { type: 'button', class: 'mini', text: 'delete',
            onclick: guard(async () => {
              await api(`/admin/links/${link.id}`, { method: 'DELETE' });
              toast('deleted');
              show('pages');
            }) }),
        ]),
      ]));
    });

    const newLabel = input('newLabel', '', { placeholder: 'label, e.g. bandcamp' });
    const newUrl = input('newUrl', '', { placeholder: 'https://… or mailto:you@example.com' });
    const newNote = input('newNote', '', { placeholder: 'one line about it (optional)' });

    box.appendChild(el('h3', { text: 'links' }));
    box.appendChild(rows);
    box.appendChild(el('div', { class: 'form-row' }, [
      newLabel, newUrl, newNote,
      el('button', { type: 'button', class: 'roomy', text: 'add',
        onclick: guard(async () => {
          if (!newLabel.value.trim() || !newUrl.value.trim()) return;
          await api(`/admin/pages/${slug}/links`, {
            method: 'POST',
            body: { label: newLabel.value, url: newUrl.value, note: newNote.value },
          });
          toast('added');
          show('pages');
        }) }),
    ]));
    box.appendChild(el('p', { class: 'row-sub', text: 'mailto links are handed out split up — the address never appears whole in the page source.' }));
    return box;
  }

  /* =====================================================================
     abschnitt: splashes
     ===================================================================== */

  const SPLASHES = {
    title: 'splashes',
    async render(into) {
      const { splashes } = await api('/admin/splashes');
      into.appendChild(el('h2', { text: 'splash texts' }));
      into.appendChild(el('p', { class: 'dim', text: 'the line under the title on the home page. one is picked at random on every visit, and clicking it rolls another. no length limit, and the text never wraps — it just runs off the edge. shift+enter puts in a line break.' }));

      // die eingabezeile steht oben: hier wird viel angelegt und selten
      // in der bestehenden liste gesucht.
      const fresh = grow(el('textarea', { name: 'newSplash', rows: 1, placeholder: 'a new splash' }));
      const addSplash = guard(async () => {
        if (!fresh.value.trim()) return;
        await api('/admin/splashes', { method: 'POST', body: { text: fresh.value } });
        toast('added');
        show('splashes');
      });
      // enter legt an, shift+enter bricht die zeile um
      fresh.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addSplash(); }
      });

      into.appendChild(el('div', { class: 'form-row' }, [
        fresh,
        el('button', { type: 'button', class: 'roomy', text: 'add', onclick: addSplash }),
      ]));

      const rows = el('div', { class: 'rows' });
      for (const splash of splashes) {
        const text = grow(el('textarea', { name: 'text', rows: 1 }));
        text.value = splash.text;

        const active = el('input', { type: 'checkbox' });
        active.checked = splash.active;

        const save = guard(async () => {
          await api(`/admin/splashes/${splash.id}`, {
            method: 'PATCH', body: { text: text.value, active: active.checked },
          });
          toast('saved');
        });
        text.addEventListener('change', save);
        active.addEventListener('change', save);
        // auch hier: enter speichert, shift+enter bricht um
        text.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); text.blur(); }
        });

        rows.appendChild(el('div', { class: `row${splash.active ? '' : ' muted'}` }, [
          el('div', { class: 'row-main' }, [text]),
          el('label', { class: 'check' }, [active, el('span', { text: 'active' })]),
          el('button', { type: 'button', class: 'mini', text: 'delete',
            onclick: guard(async () => {
              await api(`/admin/splashes/${splash.id}`, { method: 'DELETE' });
              toast('deleted');
              show('splashes');
            }) }),
        ]));
      }
      into.appendChild(rows);
    },
  };

  /* =====================================================================
     abschnitt: konto
     ===================================================================== */

  const ACCOUNT = {
    title: 'account',
    async render(into) {
      into.appendChild(el('h2', { text: 'account' }));

      const form = el('form', { class: 'form' });
      form.appendChild(field('current password',
        el('input', { type: 'password', name: 'current', autocomplete: 'current-password', required: true })));
      form.appendChild(field('new password — at least 12 characters',
        el('input', { type: 'password', name: 'next', autocomplete: 'new-password', required: true })));
      form.appendChild(el('div', { class: 'form-row' }, [
        el('button', { type: 'submit', class: 'roomy', text: 'change password' }),
      ]));

      form.addEventListener('submit', guard(async (e) => {
        e.preventDefault();
        await api('/auth/password', {
          method: 'POST',
          body: { current: val(form, 'current'), next: val(form, 'next') },
        });
        form.reset();
        toast('password changed — other sessions were signed out');
      }));

      into.appendChild(form);
      into.appendChild(el('p', { class: 'row-sub', text: 'forgot it? on the server: npm run admin:create -- <username>' }));
    },
  };

  /* =====================================================================
     rahmen
     ===================================================================== */

  const SECTIONS = { posts: POSTS, categories: CATEGORIES, shoutouts: SHOUTOUTS,
                     pages: PAGES, splashes: SPLASHES, account: ACCOUNT };

  const show = guard(async (name) => {
    const section = SECTIONS[name] || POSTS;
    nav.querySelectorAll('.chip').forEach((c) =>
      c.setAttribute('aria-pressed', String(c.dataset.section === name)));
    location.hash = name;

    panel.replaceChildren(el('p', { class: 'dim', text: 'loading …' }));
    const fresh = document.createDocumentFragment();
    await section.render(fresh);
    panel.replaceChildren(fresh);

    // wo es eine anlegen-zeile ganz oben gibt, steht der cursor gleich drin
    panel.querySelector('.form-row [name^="new"], .editor-form [name="creator"]')?.focus();
  });

  nav.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) show(chip.dataset.section);
  });

  document.getElementById('logout').addEventListener('click', guard(async () => {
    await api('/auth/logout', { method: 'POST' });
    location.href = '/';
  }));

  (async function start() {
    try {
      const me = await api('/auth/me');
      csrf = me.csrf;
      document.getElementById('who').textContent = me.username;
      show(location.hash.slice(1) || 'posts');
    } catch {
      location.href = '/login/';
    }
  })();
})();
