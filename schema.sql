-- CLUTCH FEED TILT database (Cloudflare D1: cft-db)
--   npx wrangler d1 execute cft-db --remote --file=schema.sql

-- A player is a browser cookie. The cookie holds a random token; only its SHA-256 hash is stored.
-- Every player has a name: a random two-word one (src/names.js).
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
