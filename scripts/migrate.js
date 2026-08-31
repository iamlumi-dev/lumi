// legt das schema an (idempotent). aufruf: npm run db:migrate
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../server/db.js';
import { ROOT, config } from '../server/config.js';

const sql = fs.readFileSync(path.join(ROOT, 'server', 'schema.sql'), 'utf8');
db.exec(sql);

console.log(`✓ schema angelegt in ${config.databasePath}`);
