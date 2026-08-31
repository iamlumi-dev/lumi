// sqlite-verbindung. eine einzige, prozessweite instanz (better-sqlite3 ist synchron).
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const db = new Database(config.databasePath);

// WAL = gleichzeitiges lesen waehrend geschrieben wird; fuer eine website genau richtig
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

export default db;
