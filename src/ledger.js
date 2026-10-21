// The ledger: one SHA-256 hash chain, one entry per finished run. Same design as the other games' ledgers; the chain
// helpers are copied from aura-farm src/ledger.js (which copied scoundrel.exe).
//
//   record = JSON of the run: the day, the player's id, HP left, shots, hits, the label and the shot log
//   hash   = SHA-256( prev_hash + "|" + record )
//
// The first entry chains from GENESIS. Changing any old record breaks its hash and every hash after it.
// prev_hash is UNIQUE, so two entries can never build on the same head (no forks). Records hold player ids, never
// names. An entry is written in the same D1 batch as the run, so a run is saved if and only if it is on the ledger.
//
// The run is played in the browser, so a record is what the page reported, checked only for being possible
// (src/worker.js saveRun). The server can't replay it.

export const GENESIS = "0".repeat(64);

export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function head(db) {
  const h = await db.prepare("SELECT hash FROM ledger ORDER BY id DESC LIMIT 1").first();
  return h ? h.hash : GENESIS;
}

// The insert for one run's entry chained from `prev`. The run's row is inserted earlier in the same batch; its id is
// found by (player, day), so the entry goes in only if the run did.
export async function chainInsert(db, prev, { day, playerId, record, t }) {
  const hash = await sha256(prev + "|" + record);
  return db.prepare(
    `INSERT INTO ledger (kind, day, run_id, record, prev_hash, hash, created_at)
     SELECT 'run', ?1, id, ?2, ?3, ?4, ?5 FROM runs WHERE player_id = ?6 AND day = ?1`)
    .bind(day, record, prev, hash, t, playerId);
}

export const isUnique = (e) => /UNIQUE/i.test(String(e && e.message));
