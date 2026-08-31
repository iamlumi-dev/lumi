// admin-konto anlegen oder das passwort aendern.
//   npm run admin:create -- <benutzername>
// das passwort wird abgefragt und nicht angezeigt; es steht damit weder in
// der befehlszeile noch in der shell-historie.
import readline from 'node:readline';
import { db } from '../server/db.js';
import { hashPassword } from '../server/auth.js';

const username = (process.argv[2] || '').trim();
if (!username) {
  console.error('aufruf: npm run admin:create -- <benutzername>');
  process.exit(1);
}
if (!/^[a-z0-9._-]{2,40}$/i.test(username)) {
  console.error('✗ benutzername: 2–40 zeichen, nur buchstaben, ziffern, punkt, strich, unterstrich.');
  process.exit(1);
}

// passwort einlesen, ohne es anzuzeigen: readline schreibt sonst jedes
// zeichen ins terminal — hier wird die ausgabe waehrend der eingabe stumm
// geschaltet und nur die frage selbst durchgelassen.
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = (chunk) => {
      if (!muted) process.stdout.write(chunk);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

const password = await askHidden('passwort: ');
const again = await askHidden('nochmal:  ');

if (password !== again) {
  console.error('✗ die beiden eingaben sind nicht gleich.');
  process.exit(1);
}
if (password.length < 12) {
  console.error('✗ mindestens 12 zeichen. eine passphrase aus vier wörtern reicht völlig.');
  process.exit(1);
}

const hash = await hashPassword(password);
const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

if (existing) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, existing.id);
  // alle offenen sessions dieses kontos beenden — sonst bliebe ein alter
  // login nach dem passwortwechsel weiter gueltig
  const closed = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id).changes;
  console.log(`✓ passwort für "${username}" geändert (${closed} offene session(s) beendet)`);
} else {
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
  console.log(`✓ admin "${username}" angelegt`);
}
