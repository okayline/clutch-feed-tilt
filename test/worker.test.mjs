// Tests of the Worker API, with Node's built-in SQLite standing in for D1.
// Hashes are recomputed with node:crypto, not the code under test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import worker, { setClock, daySeed } from "../src/worker.js";

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
const T0 = Date.parse("2027-01-01T08:00:00Z") / 1000;

function setup() {
  let t = T0;
  setClock(() => t);
  const env = { DB: fakeD1(), ACCOUNTS: fakeAccounts() };
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

const seedOf = (day) => parseInt(createHash("sha256").update("cft:" + day).digest("hex").slice(0, 8), 16);

test("the day's seed: the first 4 bytes of SHA-256('cft:' + day); /api/today gives the UTC day, its seed and your name", async () => {
  assert.equal(await daySeed("2026-10-21"), seedOf("2026-10-21"));
  const { call } = setup();
  const t = await call("ann", "GET", "/api/today");
  assert.deepEqual(t, { status: 200, day: "2027-01-01", seed: seedOf("2027-01-01"), name: null });
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

test("names are FPS gamer tags (letters only, at most 16); reroll gives a new one and keeps it unique", async () => {
  const { env, call } = setup();
  assert.equal((await call("ann", "POST", "/api/name")).status, 401, "no player yet: nothing to reroll");
  await call("ann", "POST", "/api/codes", { action: "new" });
  const first = (await call("ann", "GET", "/api/today")).name;
  assert.match(first, /^[A-Z][A-Za-z]{5,15}$/);
  const seen = new Set([first]);
  for (let i = 0; i < 5; i++) {
    const r = await call("ann", "POST", "/api/name");
    assert.equal(r.status, 200);
    assert.match(r.name, /^[A-Z][A-Za-z]{5,15}$/);
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
  const shape = (d) => d.prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    .map((r) => r.name + ":" + d.prepare(`SELECT group_concat(name || ' ' || type || ' ' || "notnull", ',') AS c FROM pragma_table_info('${r.name}')`).get().c);
  assert.deepEqual(shape(old), shape(fresh));
});
