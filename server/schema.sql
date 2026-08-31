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
  kind     TEXT    NOT NULL CHECK (kind IN ('image','video','audio','youtube')),
  src      TEXT    NOT NULL,                     -- pfad unter /uploads/, externe url,
                                                 -- oder bei youtube die video-id
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

-- ---- sessions -------------------------------------------------------------
-- serverseitige sessions: im cookie steht nur ein zufallstoken, in der
-- datenbank dessen sha-256-hash. wer die datenbank liest, kann daraus keine
-- gueltige session bauen. abgelaufene zeilen raeumt der server selbst weg.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions (expires_at);

-- ---- splash-texte ----------------------------------------------------------
-- die zeile unter dem titel auf der startseite. bei jedem aufruf wird eine
-- zufaellige gezogen, wie die splashes in minecraft.
CREATE TABLE IF NOT EXISTS splashes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  text       TEXT    NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_splashes_active ON splashes (active);

-- ---- shoutouts -------------------------------------------------------------
-- empfehlungen: sachen von anderen leuten, die lumi gut findet. bewusst eine
-- eigene tabelle und nicht die posts — ein shoutout ist keine eigene arbeit
-- und soll im portfolio nicht mitgezaehlt werden.
CREATE TABLE IF NOT EXISTS shoutouts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  creator    TEXT    NOT NULL,                   -- wer es gemacht hat
  title      TEXT    NOT NULL DEFAULT '',        -- wie es heisst
  kind       TEXT    NOT NULL DEFAULT 'song'
               CHECK (kind IN ('song','album','artist','video','other')),
  url        TEXT    NOT NULL DEFAULT '',        -- wo man es findet
  note       TEXT    NOT NULL DEFAULT '',        -- warum
  cover      TEXT,                               -- optionales bild unter /uploads/
  youtube    TEXT,                               -- video-id, falls url ein yt-link ist
  published  INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0,1)),
  shouted_at TEXT    NOT NULL DEFAULT (date('now')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_shoutouts_public ON shoutouts (published, shouted_at DESC);

-- ---- freitext-inhalte (about me etc.) -------------------------------------
-- damit lumi spaeter auch die "ueber mich"-seite im admin bearbeiten kann,
-- ohne dass jemand html anfassen muss.
--
-- mehrere seiten mit derselben tab_group bilden zusammen eine seite mit
-- reitern: /about/ zeigt alle pages mit tab_group = 'about', sortiert nach
-- position, und tauscht beim klick nur den mittelteil aus.
--
-- layout bestimmt, wie der body gerendert wird:
--   prose  leerzeilen trennen absaetze
--   list   jede zeile ein listeneintrag
--   links  body ist optionaler einleitungstext, die eintraege kommen
--          aus der tabelle links (weil dort echte urls gebraucht werden)
CREATE TABLE IF NOT EXISTS pages (
  slug       TEXT PRIMARY KEY,                   -- z.b. 'about', 'about-contact'
  title      TEXT NOT NULL,                      -- zugleich die beschriftung des reiters
  body       TEXT NOT NULL DEFAULT '',
  layout     TEXT NOT NULL DEFAULT 'prose'
               CHECK (layout IN ('prose','list','links')),
  tab_group  TEXT NOT NULL DEFAULT '',
  position   INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pages_group ON pages (tab_group, position);

-- ---- links (kontakt, socials) ---------------------------------------------
CREATE TABLE IF NOT EXISTS links (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  page_slug TEXT    NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
  label     TEXT    NOT NULL,
  url       TEXT    NOT NULL,
  position  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_links_page ON links (page_slug, position);
