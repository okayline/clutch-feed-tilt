-- CLUTCH FEED TILT database (Cloudflare D1: cft-db)
--   npx wrangler d1 execute cft-db --remote --file=schema.sql

-- A player is a browser cookie. The cookie holds a random token; only its SHA-256 hash is stored.
-- Every player has a name: a random lowercase gamer tag (src/names.js).
CREATE TABLE IF NOT EXISTS players (
  id          INTEGER PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,
  name        TEXT,
  name_key    TEXT UNIQUE,            -- lowercase name, so names are unique ignoring case
  created_at  INTEGER NOT NULL,       -- unix seconds
  seen_at     INTEGER NOT NULL
);

-- Devices loaded later with a save code or passkey: each has its own cookie token here. The first device's token is
-- players.token_hash. Save codes and passkeys themselves live in the shared Accounts service (dungeon-items).
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,       -- SHA-256 of the cookie token
  player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  seen_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_player ON sessions (player_id);

-- New players, counted per hashed IP and hour.
CREATE TABLE IF NOT EXISTS rate_limits (
  key           TEXT NOT NULL,
  window_start  INTEGER NOT NULL,
  count         INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);

-- Runs: one per player per UTC day. Every run is sealed on the ledger in the same D1 batch (src/ledger.js).
CREATE TABLE IF NOT EXISTS runs (
  id          INTEGER PRIMARY KEY,
  player_id   INTEGER NOT NULL REFERENCES players(id),
  day         TEXT NOT NULL,          -- the corridor's UTC day
  label       TEXT NOT NULL,          -- CLUTCH | FEED | TILT (worked out by the server)
  hp          INTEGER NOT NULL,
  shots       INTEGER NOT NULL,
  hits        INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,       -- unix seconds
  UNIQUE (player_id, day)
);
CREATE INDEX IF NOT EXISTS runs_day ON runs (day, id);   -- the day's newest runs, for ghost teammates

-- One SHA-256 hash chain: one entry per UTC day (its hash is the day's seed) and one per run (src/ledger.js).
-- Records hold player ids, never names.
CREATE TABLE IF NOT EXISTS ledger (
  id          INTEGER PRIMARY KEY,
  kind        TEXT NOT NULL,          -- day | run
  day         TEXT NOT NULL,
  run_id      INTEGER,
  record      TEXT NOT NULL,          -- the sealed JSON record
  prev_hash   TEXT NOT NULL UNIQUE,   -- one entry per chain head: the chain can't fork
  hash        TEXT NOT NULL UNIQUE,   -- SHA-256(prev_hash + "|" + record)
  created_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_one_run ON ledger (run_id) WHERE kind = 'run';
CREATE UNIQUE INDEX IF NOT EXISTS ledger_one_day ON ledger (day) WHERE kind = 'day';
