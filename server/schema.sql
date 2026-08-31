-- =========================================================================
-- lumiswork — datenbankschema
-- =========================================================================
-- alle tabellen sind idempotent angelegt (IF NOT EXISTS), migrate.js kann
-- also gefahrlos mehrfach laufen.

PRAGMA foreign_keys = ON;

-- ---- kategorien -----------------------------------------------------------
-- frei von lumi anlegbar; endnutzer filtern das portfolio danach.
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,           -- url-tauglich, kleingeschrieben
  name        TEXT    NOT NULL,                  -- anzeigename, kleingeschrieben
  description TEXT    NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0,        -- reihenfolge der filter-chips
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---- posts ----------------------------------------------------------------
-- size steuert die kachelgroesse im grid. die erlaubten werte sind bewusst
-- eine kleine, geschlossene menge, damit das grid immer lueckenlos aufgeht.
CREATE TABLE IF NOT EXISTS posts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT    NOT NULL UNIQUE,
  title        TEXT    NOT NULL,
  summary      TEXT    NOT NULL DEFAULT '',      -- kurztext auf der kachel
  body         TEXT    NOT NULL DEFAULT '',      -- langtext auf der detailseite
  size         TEXT    NOT NULL DEFAULT 'small'
                 CHECK (size IN ('small','wide','tall','large','banner')),
  published    INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0,1)),
  pinned       INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
  published_at TEXT    NOT NULL DEFAULT (datetime('now')),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_published ON posts (published, published_at DESC);

-- ---- medien ---------------------------------------------------------------
-- ein post kann 0..n medien haben, in beliebiger mischung aus bild/video/audio.
-- text-only ist damit einfach "post ohne medien" — nichts haengt voneinander ab.
CREATE TABLE IF NOT EXISTS media (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id  INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  kind     TEXT    NOT NULL CHECK (kind IN ('image','video','audio')),
  src      TEXT    NOT NULL,                     -- pfad unter /uploads/ oder externe url
  poster   TEXT,                                 -- standbild fuer video (optional)
  alt      TEXT    NOT NULL DEFAULT '',          -- barrierefreiheit / bildunterschrift
  caption  TEXT    NOT NULL DEFAULT '',
  is_cover INTEGER NOT NULL DEFAULT 0 CHECK (is_cover IN (0,1)), -- zeigt die kachel
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_media_post ON media (post_id, position);

-- ---- verknuepfung post <-> kategorie ---------------------------------------
CREATE TABLE IF NOT EXISTS post_categories (
  post_id     INTEGER NOT NULL REFERENCES posts(id)      ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_post_categories_cat ON post_categories (category_id);

-- ---- admin-nutzer ---------------------------------------------------------
-- tabelle existiert schon, wird aber erst vom spaeteren login-schritt befuellt.
-- kein passwort im klartext: nur ein hash (argon2id/bcrypt) landet hier.
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

-- ---- freitext-inhalte (about me etc.) -------------------------------------
-- damit lumi spaeter auch die "ueber mich"-seite im admin bearbeiten kann,
-- ohne dass jemand html anfassen muss.
CREATE TABLE IF NOT EXISTS pages (
  slug       TEXT PRIMARY KEY,                   -- z.b. 'about'
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
