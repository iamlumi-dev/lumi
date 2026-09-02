// =========================================================================
// zwei-faktor: zeitbasierte einmal-codes (TOTP, RFC 6238)
// =========================================================================
// bewusst selbst gerechnet statt als abhaengigkeit: das verfahren ist ein
// HMAC und eine modulo-rechnung, und es laesst sich gegen die testvektoren
// aus dem standard nachpruefen — siehe die tests am ende der datei.
//
// SHA-1 ist hier kein mangel: HMAC-SHA1 ist von den kollisionsproblemen von
// SHA-1 nicht betroffen, und alle authenticator-apps erwarten es.

import crypto from 'node:crypto';

const STEP = 30;        // sekunden pro code
const DIGITS = 6;
const DRIFT = 1;        // ein schritt vor und zurueck, gegen ungenaue uhren

/* ---- base32 (RFC 4648, ohne polster) ------------------------------------- */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of String(text).toUpperCase().replace(/[\s=-]/g, '')) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error('kein base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/* ---- codes ---------------------------------------------------------------- */

export function newSecret() {
  // 20 byte = 160 bit, wie im standard empfohlen
  return base32Encode(crypto.randomBytes(20));
}

export function stepFor(seconds = Date.now() / 1000) {
  return Math.floor(seconds / STEP);
}

// der eigentliche algorithmus: HMAC ueber den zaehler, dann "dynamic
// truncation" — vier bytes ab einem versatz, den das letzte nibble angibt
export function codeFor(secret, step, digits = DIGITS) {
  const counter = Buffer.alloc(8);
  counter.writeUInt32BE(Math.floor(step / 2 ** 32), 0);
  counter.writeUInt32BE(step >>> 0, 4);

  const mac = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const truncated = mac.readUInt32BE(offset) & 0x7fffffff;

  return String(truncated % 10 ** digits).padStart(digits, '0');
}

/**
 * prueft einen code gegen das geheimnis.
 * @returns {number|null} der schritt, der gepasst hat — oder null.
 *   der schritt wird gebraucht, um denselben code nicht zweimal
 *   zuzulassen (siehe lastStep).
 */
export function verifyCode(secret, input, { lastStep = null, now = Date.now() / 1000 } = {}) {
  const clean = String(input || '').replace(/\D/g, '');
  if (clean.length !== DIGITS) return null;

  const current = stepFor(now);
  for (let offset = -DRIFT; offset <= DRIFT; offset++) {
    const step = current + offset;
    // ein bereits benutzter code gilt nicht nochmal — sonst koennte ihn
    // jemand, der mitgelesen hat, innerhalb des zeitfensters wiederverwenden
    if (lastStep !== null && step <= lastStep) continue;

    const expected = codeFor(secret, step);
    // konstante laufzeit, damit die dauer nichts ueber den code verraet
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return step;
  }
  return null;
}

/* ---- einrichtung ---------------------------------------------------------- */

// die adresse, die eine authenticator-app als QR-code liest
export function otpauthUri(secret, { account, issuer }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP),
  });
  return `otpauth://totp/${label}?${params}`;
}

/* ---- wiederherstellungs-codes -------------------------------------------- */

// falls das handy verloren geht. hoher zufallsanteil, deshalb genuegt
// sha-256 zum speichern — anders als bei passwoertern ist hier nichts zu raten.
export function newRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(5).toString('hex').replace(/(.{5})/, '$1-'));
}

export function hashRecoveryCode(code) {
  return crypto.createHash('sha256')
    .update(String(code).toLowerCase().replace(/[\s-]/g, ''))
    .digest('hex');
}
