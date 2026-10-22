-- v0.11: ghost teammates. /api/today reads up to 3 of the day's newest runs; this index lets it read only those.
CREATE INDEX IF NOT EXISTS runs_day ON runs (day, id);
