-- v0.4: runs and the ledger. One run per player per UTC day; every run is sealed on the ledger in the same D1 batch.
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

-- One SHA-256 hash chain, one entry per run (src/ledger.js). Records hold player ids, never names.
CREATE TABLE IF NOT EXISTS ledger (
  id          INTEGER PRIMARY KEY,
  kind        TEXT NOT NULL,          -- run
  day         TEXT NOT NULL,
  run_id      INTEGER,
  record      TEXT NOT NULL,          -- the sealed JSON record
  prev_hash   TEXT NOT NULL UNIQUE,   -- one entry per chain head: the chain can't fork
  hash        TEXT NOT NULL UNIQUE,   -- SHA-256(prev_hash + "|" + record)
  created_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_one_run ON ledger (run_id) WHERE kind = 'run';
