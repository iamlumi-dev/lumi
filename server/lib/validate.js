// pruefung aller werte, die von aussen kommen.
// grundsatz: nichts durchlassen, was nicht ausdruecklich erlaubt ist.

export class BadRequest extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

export function str(value, field, { min = 0, max = 10000, trim = true } = {}) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw new BadRequest(`${field}: text erwartet`);
  const out = trim ? value.trim() : value;
  if (out.length < min) throw new BadRequest(`${field}: mindestens ${min} zeichen`);
  if (out.length > max) throw new BadRequest(`${field}: höchstens ${max} zeichen`);
  return out;
}

export function oneOf(value, field, allowed) {
  if (!allowed.includes(value)) {
    throw new BadRequest(`${field}: erlaubt sind ${allowed.join(', ')}`);
  }
  return value;
}

export function bool(value) {
  return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
}

export function int(value, field, { min = -Infinity, max = Infinity } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n)) throw new BadRequest(`${field}: ganze zahl erwartet`);
  if (n < min || n > max) throw new BadRequest(`${field}: zwischen ${min} und ${max}`);
  return n;
}

export function intList(value, field) {
  if (!Array.isArray(value)) throw new BadRequest(`${field}: liste erwartet`);
  return value.map((v) => int(v, field));
}

// datum als YYYY-MM-DD oder YYYY-MM-DD HH:MM:SS
export function dateTime(value, field) {
  const s = str(value, field, { max: 40 });
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (!m) throw new BadRequest(`${field}: format YYYY-MM-DD oder YYYY-MM-DD HH:MM`);
  return `${m[1]} ${m[2] || '00:00'}:${m[3] || '00'}`;
}

/* ---- urls ----------------------------------------------------------------
   nur wenige schemata sind erlaubt. javascript: und data: sind ausdruecklich
   ausgeschlossen — ueber die liesse sich sonst code in einen link schmuggeln. */
const SAFE_SCHEMES = ['http:', 'https:', 'mailto:'];

export function url(value, field, { allowRelative = true } = {}) {
  const s = str(value, field, { min: 1, max: 2000 });

  // interner pfad, z.b. /uploads/…
  if (s.startsWith('/')) {
    if (!allowRelative) throw new BadRequest(`${field}: vollständige adresse erwartet`);
    if (s.startsWith('//')) throw new BadRequest(`${field}: ungültiger pfad`);
    return s;
  }

  let parsed;
  try {
    parsed = new URL(s);
  } catch {
    throw new BadRequest(`${field}: keine gültige adresse`);
  }
  if (!SAFE_SCHEMES.includes(parsed.protocol)) {
    throw new BadRequest(`${field}: nur ${SAFE_SCHEMES.join(' ')} oder ein pfad mit /`);
  }
  return s;
}

/* ---- youtube -------------------------------------------------------------
   akzeptiert die uebliche adresse, die kurzform und die reine id — gespeichert
   wird immer nur die id. damit kann in den einbettungs-code nichts einsickern. */
export function youtubeId(value, field) {
  const s = str(value, field, { min: 1, max: 200 });

  if (/^[\w-]{11}$/.test(s)) return s;

  let parsed;
  try {
    parsed = new URL(s);
  } catch {
    throw new BadRequest(`${field}: keine youtube-adresse und keine video-id`);
  }

  const host = parsed.hostname.replace(/^www\./, '');
  let id = null;
  if (host === 'youtu.be') id = parsed.pathname.slice(1);
  else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    id = parsed.searchParams.get('v')
      || (/^\/(embed|shorts|live|v)\/([\w-]{11})/.exec(parsed.pathname) || [])[2];
  }

  if (!id || !/^[\w-]{11}$/.test(id)) throw new BadRequest(`${field}: keine youtube-video-id erkennbar`);
  return id;
}
