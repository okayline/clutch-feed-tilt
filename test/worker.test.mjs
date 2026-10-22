// Tests of the Worker API, with Node's built-in SQLite standing in for D1.
// Hashes are recomputed with node:crypto, not the code under test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import worker, { setClock } from "../src/worker.js";
import * as C from "../public/engine/corridor.js";
import { playBot } from "./bot.mjs";
const { level } = C;

// a tiny D1 lookalike (copied from scoundrel.exe test/worker.test.mjs)
function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const prep = (sql, args = []) => ({
    sql, args,
    bind: (...a) => prep(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes } }; },
  });
  const batch = async (stmts) => {
    db.exec("BEGIN");
    try {
      // like D1: every statement in the batch gets its rows (reads) or its change count (writes)
      const out = stmts.map((st) => /^\s*(SELECT|WITH)/i.test(st.sql) || /RETURNING/i.test(st.sql)
        ? { results: db.prepare(st.sql).all(...st.args), meta: { changes: 0 } }
        : { results: [], meta: { changes: db.prepare(st.sql).run(...st.args).changes } });
      db.exec("COMMIT");
      return out;
    } catch (e) { db.exec("ROLLBACK"); throw e; }
  };
  return { prepare: (sql) => prep(sql), batch, raw: db };
}

// A stand-in for the shared accounts (the Accounts entrypoint of dungeon-items, tested there), copied from
// scoundrel.exe's tests: same answers, kept in maps. A "passkey" is any credential { id } that was registered.
function fakeAccounts() {
  let n = 0; const codes = new Map(), keys = new Map(), links = new Map();
  const err = (error, status = 400) => ({ error, status });
  const own = (id) => [...codes].filter(([, v]) => v.acct === id);
  return {
    links,
    async createAccount() { return { accountId: ++n }; },
    async addCode(id) {
      const code = "CODE-" + (codes.size + 1) + "-" + id;
      codes.set(code, { acct: id, id: codes.size + 1 }); return { code };
    },
    async removeCode(id, cid) { const e = [...codes].find(([, v]) => v.acct === id && v.id === cid); if (!e) return err("No such save code.", 404); codes.delete(e[0]); return { ok: true }; },
    async loginCode({ code }) { const v = codes.get(code); return v ? { accountId: v.acct } : err("That save code didn't work. Check it and try again.", 404); },
    async info(id) { return { codes: own(id).map(([, v]) => ({ id: v.id, created_at: 1, last_used_at: null })), passkeys: [...keys].filter(([, v]) => v.acct === id).map(([, v]) => ({ id: v.id, label: v.label })), games: [] }; },
    async waysIn(id) { return own(id).length + [...keys].filter(([, v]) => v.acct === id).length; },
    async playerFor(id, g) { return { playerId: links.get(id + "|" + g) ?? null }; },
    async link(id, g, p) {
      if (links.has(id + "|" + g)) return { playerId: links.get(id + "|" + g), linked: links.get(id + "|" + g) === p };
      if ([...links].some(([k, v]) => k.endsWith("|" + g) && v === p)) return { playerId: null, linked: false, taken: true };
      links.set(id + "|" + g, p); return { playerId: p, linked: true };
    },
    async accountOf(g, p) { const e = [...links].find(([k, v]) => k.endsWith("|" + g) && v === p); return { accountId: e ? Number(e[0].split("|")[0]) : null }; },
    async passkeyRegisterOptions({ accountId, origin }) { return { challenge: "c-" + accountId, origin }; },
    async passkeyRegister({ accountId, credential, label }) { keys.set(credential.id, { acct: accountId, id: keys.size + 1, label }); return { ok: true }; },
    async passkeyLoginOptions({ origin }) { return { challenge: "login", origin }; },
    async passkeyLogin({ credential }) { const k = keys.get(credential?.id); return k ? { accountId: k.acct } : err("That passkey isn't saved here.", 400); },
    async passkeyRemove(id, kid) { const e = [...keys].find(([, v]) => v.acct === id && v.id === kid); if (!e) return err("No such passkey.", 404); keys.delete(e[0]); return { ok: true }; },
  };
}
// 4Dungeon's board (daily-dungeon-board), only the table read here: the CREATE is daily-dungeon leaderboard/worker.js giftTable's
function fakeBoard() {
  const d = fakeD1.call(null);
  d.raw.exec("CREATE TABLE tallies (k TEXT NOT NULL, door INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0, made INTEGER NOT NULL, PRIMARY KEY (k, door))");
  return d;
}
const T0 = Date.parse("2027-01-01T08:00:00Z") / 1000;

function setup() {
  let t = T0;
  setClock(() => t);
  const env = { DB: fakeD1(), DUNGEON: fakeBoard(), ACCOUNTS: fakeAccounts(), REGISTRY: { sent: [], async checkpoint(c) { this.sent.push(c); return { ok: true, created: true }; } } };
  const jar = {};
  const call = async (who, method, path, body) => {
    const headers = { "content-type": "application/json" };
    const mine = (jar[who] ||= {});
    if (Object.keys(mine).length) headers.cookie = Object.entries(mine).map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await worker.fetch(new Request("https://cft.test" + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
    for (const c of res.headers.getSetCookie()) {
      const [k, v] = c.split(";")[0].split("=");
      if (/Max-Age=0/.test(c)) delete mine[k]; else mine[k] = v;
    }
    return { status: res.status, ...(await res.json()) };
  };
  return { env, call };
}

const sha = (t) => createHash("sha256").update(t).digest("hex");
// the day's ledger record: the day and its 4Dungeon level (level() has its own test in engine.test.mjs)
// and how far the floor is open: the run's 2 wings when 4Dungeon's board has no tallies
const dayRec = (day, wing = 2) => { const L = level(day); return JSON.stringify({ day, level: L.name, floor: L.seed, wing }); };

test("the day's seed: the first 4 bytes of the hash of the day's ledger entry; /api/today gives the UTC day, its seed, your name and your run", async () => {
  const { env, call } = setup();
  const t = await call("ann", "GET", "/api/today"), dayHash = sha("0".repeat(64) + "|" + dayRec("2027-01-01"));
  assert.deepEqual(t, { status: 200, day: "2027-01-01", seed: parseInt(dayHash.slice(0, 8), 16), wing: 2, name: null, run: null, ghosts: [] });
  assert.equal((await call("bo", "GET", "/api/today")).seed, t.seed, "the same seed for everyone");
  assert.deepEqual(env.DB.raw.prepare("SELECT kind, record, hash FROM ledger").all().map((r) => ({ ...r })),
    [{ kind: "day", record: dayRec("2027-01-01"), hash: dayHash }], "one day entry, sealed by the first request");
  assert.equal((await call("ann", "GET", "/api/nope")).status, 404);
});

test("save codes and passkeys: load your player on another device, log out only with a way back in", async () => {
  const { env, call } = setup();
  assert.equal((await call("ann", "GET", "/api/account")).player, false, "just looking makes no player");
  const { code } = await call("ann", "POST", "/api/codes", { action: "new" });
  const name = (await call("ann", "GET", "/api/today")).name;
  assert.ok(name, "making a code made a named player");
  assert.equal((await call("phone", "POST", "/api/load", { code: "WRONG" })).status, 404);
  assert.equal((await call("phone", "POST", "/api/load", { code })).name, name);
  assert.equal((await call("phone", "GET", "/api/account")).devices, 2);
  await call("phone", "POST", "/api/passkey", { action: "register", label: "phone", credential: { id: "key1" } });
  assert.equal((await call("ann", "GET", "/api/account")).passkeys.length, 1);
  assert.equal((await call("ann", "POST", "/api/logout")).status, 200);
  assert.equal((await call("ann", "GET", "/api/account")).player, false, "logged out");
  assert.equal((await call("ann", "POST", "/api/passkey", { action: "login", credential: { id: "key1" } })).name, name);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM players").get().n, 1, "logging in never made a second player");
  // a browser with no code or passkey can't log out
  await call("bo", "POST", "/api/passkey", { action: "register_options" });
  assert.equal((await call("bo", "POST", "/api/logout")).status, 400);
});

test("names are FPS gamer tags (lowercase letters and digits, at most 16); reroll gives a new one and keeps it unique", async () => {
  const { env, call } = setup();
  assert.equal((await call("ann", "POST", "/api/name")).status, 401, "no player yet: nothing to reroll");
  await call("ann", "POST", "/api/codes", { action: "new" });
  const first = (await call("ann", "GET", "/api/today")).name;
  assert.match(first, /^[a-z][a-z0-9]{3,15}$/);
  const seen = new Set([first]);
  for (let i = 0; i < 5; i++) {
    const r = await call("ann", "POST", "/api/name");
    assert.equal(r.status, 200);
    assert.match(r.name, /^[a-z][a-z0-9]{3,15}$/);
    assert.equal((await call("ann", "GET", "/api/today")).name, r.name, "the new name is the one kept");
    seen.add(r.name);
  }
  const rows = env.DB.raw.prepare("SELECT name, name_key FROM players").all();
  assert.deepEqual(rows.map((r) => r.name_key), [rows[0].name.toLowerCase()], "one player, its name_key follows");
});

test("the migrations build the same tables as schema.sql", () => {
  const fresh = new DatabaseSync(":memory:"), old = new DatabaseSync(":memory:");
  fresh.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  old.exec(readFileSync(new URL("../migrations/001_players.sql", import.meta.url), "utf8"));
  old.exec(readFileSync(new URL("../migrations/002_ledger.sql", import.meta.url), "utf8"));
  old.exec(readFileSync(new URL("../migrations/003_day_entries.sql", import.meta.url), "utf8"));
  old.exec(readFileSync(new URL("../migrations/004_runs_day.sql", import.meta.url), "utf8"));
  const shape = (d) => d.prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    .map((r) => r.name + ":" + d.prepare(`SELECT group_concat(name || ' ' || type || ' ' || "notnull", ',') AS c FROM pragma_table_info('${r.name}')`).get().c);
  assert.deepEqual(shape(old), shape(fresh));
});

test("a run is sealed on the ledger: the server plays it again from its inputs, seals what it got, one a day, chained by SHA-256(prev + '|' + record)", async () => {
  const { env, call } = setup();
  const day = "2027-01-01", dayHash = sha("0".repeat(64) + "|" + dayRec(day)), seed = parseInt(dayHash.slice(0, 8), 16);
  // played the way the page plays it (as in engine.test.mjs): walk to the exit, shoot what comes out, and some misses
  const live = playBot(C.corridor(seed, day, 2), { shootWall: 9 });
  assert.ok(live.escaped && live.shots > live.hits);
  const inputs = live.log.map((s) => s.slice(0, 3));
  const sh = inputs.findIndex((s) => s[1] === 2);
  assert.equal((await call("ann", "POST", "/api/run", { day, inputs: [inputs[sh], ...inputs.slice(0, sh), ...inputs.slice(sh + 1)] })).status, 400, "out of order");
  assert.equal((await call("ann", "POST", "/api/run", { day, inputs: [...inputs, [live.tick + 1, 2, 10]] })).status, 400, "a shot after the end");
  assert.equal((await call("ann", "POST", "/api/run", { day: "2026-12-31", inputs })).status, 409, "yesterday's corridor");
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM ledger WHERE kind = 'run'").get().n, 0, "no run sealed so far");

  // what the page says it got is ignored: the server's replay decides
  const a = await call("ann", "POST", "/api/run", { day, inputs, hp: 1, hits: 0, label: "FEED" });
  assert.equal(a.status, 200);
  assert.deepEqual([a.run.hp, a.run.shots, a.run.hits, a.run.label], [live.hp, live.shots, live.hits, C.label(live)], "the same run as played");
  const annId = env.DB.raw.prepare("SELECT id FROM players").get().id;
  const rec1 = JSON.stringify({ day, player: annId, hp: live.hp, shots: live.shots, hits: live.hits, label: C.label(live), inputs: live.log });
  assert.equal(a.run.hash, sha(dayHash + "|" + rec1), "the first run chains from the day's entry");
  assert.deepEqual(env.REGISTRY.sent, [{ game: "clutch-feed-tilt", entries: 2, head: a.run.hash, detail: { day, label: C.label(live), hp: live.hp, hits: live.hits, shots: live.shots } }], "the registry got a checkpoint: the day and the run, the run's hash as the head, and the run's day, label, HP, hits and shots");
  assert.equal((await call("ann", "GET", "/api/today")).run.entry, a.run.entry, "today shows your sealed run");
  assert.equal((await call("ann", "POST", "/api/run", { day, inputs })).status, 409, "one run a day");

  // a second player who never moved: nobody sees them, the time runs out, and they never got out
  env.REGISTRY.checkpoint = async () => { throw new Error("registry away"); };   // a registry that's away never stops a run
  const b = await call("bo", "POST", "/api/run", { day, inputs: [], hp: 3, hits: 3 });
  assert.deepEqual([b.run.hp, b.run.shots, b.run.hits, b.run.label], [3, 0, 0, "FEED"]);
  const boId = env.DB.raw.prepare("SELECT MAX(id) AS id FROM players").get().id;
  const rec2 = JSON.stringify({ day, player: boId, hp: 3, shots: 0, hits: 0, label: "FEED", inputs: [] });
  assert.equal(b.run.hash, sha(a.run.hash + "|" + rec2));
  assert.deepEqual(env.DB.raw.prepare("SELECT record FROM ledger ORDER BY id").all().map((r) => r.record), [dayRec(day), rec1, rec2], "records hold ids, never names");
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM runs").get().n, 2);

  // the LEDGER panel's list: newest first, the same records and hashes as sealed, paged with before and limit
  const all = await call("ann", "GET", "/api/ledger");
  assert.deepEqual(all.entries.map((e) => [e.kind, e.record, e.hash]), [["run", rec2, b.run.hash], ["run", rec1, a.run.hash], ["day", dayRec(day), dayHash]]);
  const page = await call("ann", "GET", `/api/ledger?limit=1&before=${all.entries[0].id}`);
  assert.deepEqual(page.entries.map((e) => e.hash), [a.run.hash]);
});

test("ghosts: /api/today gives up to 3 other players' runs that day, newest first, with their names and inputs (not yours, not other days')", async () => {
  const { env, call } = setup();
  const day = "2027-01-01", seed = (await call("x", "GET", "/api/today")).seed;
  const live = playBot(C.corridor(seed, day, 2)), inputs = live.log.map((s) => s.slice(0, 3));
  for (const [i, who] of ["ann", "bo", "cy", "di", "ed"].entries()) {
    setClock(() => T0 + i * 3601);   // an hour apart, under the new-player limit, all on the same UTC day
    await call(who, "POST", "/api/codes", { action: "new" });   // a player with a name
    assert.equal((await call(who, "POST", "/api/run", { day, inputs })).status, 200);
  }
  const name = (who) => env.DB.raw.prepare("SELECT name FROM players ORDER BY id LIMIT 1 OFFSET ?").get(["ann", "bo", "cy", "di", "ed"].indexOf(who)).name;
  // a run sealed before v0.11 (no inputs in its record) is left out
  env.DB.raw.prepare("UPDATE ledger SET record = json_remove(record, '$.inputs') WHERE run_id = (SELECT MAX(id) FROM runs)").run();
  const t = await call("ann", "GET", "/api/today");
  assert.deepEqual(t.ghosts.map((g) => g.name), [name("di"), name("cy")], "ed's run is old-style; ann's own is left out; at most 3 read");
  assert.deepEqual(t.ghosts[0].inputs, inputs, "the inputs as sent, to play again");
  const sealed = JSON.parse(env.DB.raw.prepare("SELECT record FROM ledger WHERE kind = 'run' ORDER BY id DESC LIMIT 1 OFFSET 1").get().record);
  assert.deepEqual([t.ghosts[0].hp, t.ghosts[0].shots, t.ghosts[0].hits], [sealed.hp, sealed.shots, sealed.hits], "with the HP, shots and hits it was sealed with");
  const plan = env.DB.raw.prepare("EXPLAIN QUERY PLAN SELECT p.name, l.record FROM runs r JOIN players p ON p.id = r.player_id JOIN ledger l ON l.kind = 'run' AND l.run_id = r.id WHERE r.day = ? AND r.player_id != ? ORDER BY r.id DESC LIMIT 3").all(day, 1);
  assert.ok(plan.some((r) => /USING INDEX runs_day/.test(r.detail)), "read through the runs_day index: " + JSON.stringify(plan.map((r) => r.detail)));
});

test("how far the floor is open: the furthest wing 4Dungeon's players opened this quarter, plus 2 (counting from 1), read once when the day is sealed", async () => {
  const { env, call } = setup();
  // 2027-01-01 is day 20819 since 1970; its quarter (B1F, wing 1 from 0, in engine.test.mjs's terms) began on day 20818
  assert.equal(Date.parse("2027-01-01") / 86400000, 20819);
  assert.deepEqual([level("2027-01-01").wing, level("2027-01-01").first], [1, 20818]);
  const add = (k, door) => env.DUNGEON.raw.prepare("INSERT INTO tallies (k, door, n, made) VALUES (?, ?, 1, 0)").run(k, door);
  add("20817:1:5", 0);   // the quarter before: not counted
  add("20818:2:1", 1);   // opened wing 1's door: wing 2 (from 0) is built
  add("20819:1:3", 0);   // today, wing 3's door: wing 4 built, so open to wing 5 (from 1)
  add("20820:1:6", 0);   // tomorrow (a wrong clock): not counted
  const t = await call("ann", "GET", "/api/today");
  assert.equal(t.wing, 5);
  assert.equal(env.DB.raw.prepare("SELECT record FROM ledger").get().record, dayRec("2027-01-01", 5), "on the day's ledger entry");
  add("20819:1:4", 1);
  assert.equal((await call("bo", "GET", "/api/today")).wing, 5, "fixed for the day once sealed");
  const plan = env.DUNGEON.raw.prepare("EXPLAIN QUERY PLAN SELECT k FROM tallies WHERE k >= ?1 AND k < ?2").all("20818:", "20820:");
  assert.ok(plan.some((r) => /USING (COVERING )?INDEX sqlite_autoindex_tallies_1 \(k>\? AND k<\?\)/.test(r.detail)), "a range of the key: " + JSON.stringify(plan.map((r) => r.detail)));
  // a day with no board to ask (or no tallies): the run's 2 wings
  const other = setup(); delete other.env.DUNGEON;
  assert.equal((await other.call("cy", "GET", "/api/today")).wing, 2);
});
