-- v0.6: the ledger makes the map. One 'day' entry per UTC day, sealed by the first request of the day; its hash is the
-- day's seed (src/ledger.js dayEntry).
CREATE UNIQUE INDEX IF NOT EXISTS ledger_one_day ON ledger (day) WHERE kind = 'day';
