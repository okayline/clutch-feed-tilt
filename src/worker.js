// CLUTCH FEED TILT Worker. The page and its files are static assets; /api/* comes here first.
//
//   GET  /api/today                    { day, seed, name, run }: today's date in UTC (from the server's clock, so a wrong
//                                      phone clock can't pick another day), its seed, your name if you have a player, and
//                                      your run today if you've sealed one
//   POST /api/run {day, hp, shots, hits, log}   seal today's run on the ledger (one per player per day)
//   POST /api/name                     reroll your name: a new random gamer tag (names can't be typed)
//   GET  /api/account                  your name, save codes, passkeys and devices
//   POST /api/codes {action, id}       "new": make a save code (shown once); "remove": forget one
//   POST /api/load  {code}             load the player a save code belongs to on this device (log in)
//   POST /api/passkey {action ...}     register_options / register / login_options / login / remove
//   POST /api/logout                   this browser forgets its player (needs a save code or passkey first)
//
// The seed is the first 4 bytes of SHA-256("cft:" + day), as an unsigned number: everyone gets the same corridor.

import { giveName } from "./names.js";
import { head, chainInsert, isUnique } from "./ledger.js";
import * as C from "../public/engine/corridor.js";

const COOKIE = "cft";
const COOKIE_MAX_AGE = 400 * 86400;
const SEEN_EVERY = 900;   // 15 minutes

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (env.CANONICAL_HOST && url.hostname.endsWith(".workers.dev")) {
      return Response.redirect(`https://${env.CANONICAL_HOST}${url.pathname}${url.search}`, 301);
    }
    if (!url.pathname.startsWith("/api/")) return env.ASSETS ? env.ASSETS.fetch(req) : new Response("Not found", { status: 404 });
    try {
      const route = ROUTES[`${req.method} ${url.pathname}`];
      if (!route) return json({ error: "No such thing." }, 404);
      return await route(req, env, url);
    } catch (e) {
      if (e instanceof Oops) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: "Something broke. Try again in a moment." }, 500);
    }
  },
};

class Oops extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const ROUTES = {
  "GET /api/today": today,
  "POST /api/name": setName,
  "POST /api/run": saveRun,
  "GET /api/account": account,
  "POST /api/codes": codes,
  "POST /api/load": loadCode,
  "POST /api/passkey": passkey,
  "POST /api/logout": logout,
};

// ---------- helpers ----------

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

// the clock, in unix seconds (tests move it with setClock)
let clock = () => Math.floor(Date.now() / 1000);
export function setClock(fn) { clock = fn; }
const now = () => clock();
export const utcDay = (t = now()) => new Date(t * 1000).toISOString().slice(0, 10);

export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function daySeed(day) {
  return parseInt((await sha256("cft:" + day)).slice(0, 8), 16);
}

function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function readCookie(req, name = COOKIE) {
  const m = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([A-Za-z0-9_-]{20,})`));
  return m ? m[1] : null;
}

const setCookie = (token) => `${COOKIE}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
const clearCookie = (name) => `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
// This browser's own player (one with no save code or passkey), kept while the browser is logged in as someone else,
// so logging out goes back to it instead of making a new player.
const HOME = COOKIE + "h";
const setHome = (token) => `${HOME}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;

// The player behind this request's cookie, or null. Never creates one (so crawlers don't make players).
// The first device's token is players.token_hash; a device loaded later with a save code or passkey has its own
// token in `sessions`.
async function findPlayer(req, env) {
  const token = readCookie(req);
  if (!token) return null;
  const h = await sha256(token);
  const p = await env.DB.prepare(
    `SELECT id, name, seen_at, NULL AS s_seen FROM players WHERE token_hash = ?1
     UNION ALL SELECT p.id, p.name, p.seen_at, s.seen_at FROM sessions s JOIN players p ON p.id = s.player_id WHERE s.token_hash = ?1
     LIMIT 1`).bind(h).first();
  if (!p) return null;
  if (p.s_seen !== null && now() - p.s_seen >= SEEN_EVERY) await env.DB.prepare("UPDATE sessions SET seen_at = ? WHERE token_hash = ?").bind(now(), h).run();
  if (now() - p.seen_at >= SEEN_EVERY) await env.DB.prepare("UPDATE players SET seen_at = ? WHERE id = ?").bind(now(), p.id).run();
  return giveName(env, { id: p.id, name: p.name });
}

// The player behind this request, made on the spot if there is none (with a cookie to set).
async function needPlayer(req, env) {
  const found = await findPlayer(req, env);
  if (found) return { player: found };
  if (!(await rateLimit(env, req, "new-guest", 3, 3600))) throw new Oops("Too many new players from here. Try again later.", 429);
  const token = newToken(), t = now();
  const r = await env.DB.prepare("INSERT INTO players (token_hash, created_at, seen_at) VALUES (?, ?, ?) RETURNING id, name")
    .bind(await sha256(token), t, t).first();
  return { player: await giveName(env, r), cookie: setCookie(token) };
}

async function mustPlayer(req, env) {
  const p = await findPlayer(req, env);
  if (!p) throw new Oops("Make a save code or passkey first.", 401);
  return p;
}

async function body(req) {
  try { return await req.json(); } catch { throw new Oops("That request didn't make sense."); }
}

const withCookie = (res, cookie) => { for (const c of [cookie].flat()) if (c) res.headers.append("set-cookie", c); return res; };

// ---------- today ----------

async function today(req, env) {
  const day = utcDay();
  const player = await findPlayer(req, env);
  return json({ day, seed: await daySeed(day), name: player ? player.name : null, run: player ? await runOf(env, player.id, day) : null });
}

// ---------- runs and the ledger ----------

// This player's sealed run on that day, with its ledger entry, or null.
async function runOf(env, playerId, day) {
  return env.DB.prepare(
    `SELECT r.label, r.hp, r.shots, r.hits, l.id AS entry, l.hash FROM runs r JOIN ledger l ON l.kind = 'run' AND l.run_id = r.id
     WHERE r.player_id = ? AND r.day = ?`).bind(playerId, day).first();
}

const MAX_SHOTS = 500;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

// Seal today's run. The run is played in the browser and the server can't replay it, so it only checks the run is
// possible: today's corridor, HP 0 to 3, one hit per enemy you face (all of them if you're alive, fewer if you died),
// and a shot log with one [seconds, column, row, hit] per shot that adds up to the hits. The label is worked out here.
// The run and its ledger entry are one D1 batch.
async function saveRun(req, env) {
  const b = await body(req), day = utcDay();
  if (b.day !== day) throw new Oops("That day's corridor is over. This run can't be sealed.", 409);
  const foes = C.corridor(await daySeed(day)).enemies.length;
  const { hp, shots, hits, log } = b;
  const possible = int(hp, 0, C.HP) && int(shots, 0, MAX_SHOTS) && int(hits, 0, foes) && hits <= shots
    && (hp > 0 ? hits === foes : hits < foes)
    && Array.isArray(log) && log.length === shots
    && log.every((s, i) => Array.isArray(s) && s.length === 4 && s.slice(0, 3).every(Number.isFinite) && (s[3] === 0 || s[3] === 1)
                           && s[0] >= 0 && (i === 0 || s[0] >= log[i - 1][0]))
    && log.filter((s) => s[3] === 1).length === hits;
  if (!possible) throw new Oops("That run doesn't add up. It wasn't sealed.");
  const { player, cookie } = await needPlayer(req, env);
  const label = C.label({ hp, shots, hits });
  const record = JSON.stringify({ day, player: player.id, hp, shots, hits, label, log });
  const done = () => runOf(env, player.id, day);
  if (await done()) throw new Oops("You've already sealed a run today. A new corridor opens at midnight UTC.", 409);
  for (let i = 0; i < 3; i++) {
    const t = now();
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO runs (player_id, day, label, hp, shots, hits, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(player.id, day, label, hp, shots, hits, t),
        await chainInsert(env.DB, await head(env.DB), { day, playerId: player.id, record, t }),
      ]);
      return withCookie(json({ run: await done() }), cookie);
    } catch (e) {
      if (!isUnique(e)) throw e;
      if (await done()) throw new Oops("You've already sealed a run today. A new corridor opens at midnight UTC.", 409);
      // someone else sealed at the same moment (the head moved): chain from the new head
    }
  }
  throw new Oops("The ledger is busy. Try again in a moment.", 503);
}

// Reroll: a new random name nobody has. Only for a player that already exists (looking never makes one).
async function setName(req, env) {
  const player = await mustPlayer(req, env);
  const p = await giveName(env, player, { reroll: true });
  return json({ name: p.name });
}

// ---------- save codes and passkeys (kept by the shared Accounts service in dungeon-items) ----------
// This game keeps its own players and cookie. Save codes and passkeys belong to an account there; the account says
// which player here is yours. A player gets an account the first time they make a code or passkey.
// (Copied from aura-farm src/worker.js, which copied scoundrel.exe.)

const GAME = "clutch-feed-tilt";
const ACC = (env) => { if (!env.ACCOUNTS) throw new Oops("Accounts are unavailable right now. Try again in a moment.", 503); return env.ACCOUNTS; };
const ipOf = (req) => req.headers.get("cf-connecting-ip") || "unknown";
const ok = (r) => { if (r && r.error) throw new Oops(r.error, r.status || 400); return r; };

// Load a player on this device: a new token for it in `sessions`. Returns the cookie.
async function newSession(env, playerId) {
  const token = newToken(), t = now();
  await env.DB.prepare("INSERT INTO sessions (token_hash, player_id, created_at, seen_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256(token), playerId, t, t).run();
  return setCookie(token);
}

// Fixed window per hashed IP and action. Returns true if allowed.
async function rateLimit(env, req, action, limit, windowSecs) {
  const key = action + ":" + (await sha256("ip:" + ipOf(req))).slice(0, 32);
  const t = now(), windowStart = t - (t % windowSecs);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1 RETURNING count`).bind(key, windowStart).first();
  if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(t - 86400).run();
  return row.count <= limit;
}

// This player's account id (or null; made on the spot with `make`).
async function accountFor(env, player, make = false) {
  const acc = ACC(env);
  let id = (await acc.accountOf(GAME, player.id)).accountId;
  if (id || !make) return id ?? null;
  id = (await acc.createAccount()).accountId;
  if (!ok(await acc.link(id, GAME, player.id)).linked) throw new Oops("That didn't work. Try again.");
  return id;
}

// Log this browser in as the account's player here: the one it already has, else this browser's own player (if it has
// no account yet), else a new one. Returns { player, cookie }.
async function enter(req, env, accountId) {
  const acc = ACC(env);
  const cur = await findPlayer(req, env);
  const curIsGuest = cur && !(await acc.accountOf(GAME, cur.id)).accountId;
  let { playerId } = await acc.playerFor(accountId, GAME);
  if (!playerId) {
    if (curIsGuest) playerId = cur.id;
    else {
      if (!(await rateLimit(env, req, "new-player", 20, 3600))) throw new Oops("Too many new players from here. Try again later.", 429);
      const t = now();
      playerId = (await env.DB.prepare("INSERT INTO players (token_hash, created_at, seen_at) VALUES (?, ?, ?) RETURNING id").bind(await sha256(newToken()), t, t).first()).id;
    }
    playerId = ok(await acc.link(accountId, GAME, playerId)).playerId;
  }
  const p = await env.DB.prepare("SELECT id, name FROM players WHERE id = ?").bind(playerId).first();
  if (!p) throw new Oops("That player is gone.", 404);
  const player = await giveName(env, p);
  const cookie = [await newSession(env, player.id)];
  if (curIsGuest && cur.id !== player.id) cookie.push(setHome(readCookie(req)));   // the browser's own player is left behind: remember it
  return { player, cookie };
}

async function account(req, env) {
  const player = await findPlayer(req, env);
  if (!player) return json({ player: false, name: null, codes: [], passkeys: [], devices: 0 });
  const id = await accountFor(env, player);
  const ways = id ? ok(await ACC(env).info(id)) : { codes: [], passkeys: [] };
  const devices = 1 + (await env.DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE player_id = ?").bind(player.id).first()).n;
  return json({ player: true, name: player.name, codes: ways.codes, passkeys: ways.passkeys, devices });
}

async function codes(req, env) {
  const b = await body(req);
  if (b.action === "new") {
    const { player, cookie } = await needPlayer(req, env);
    const r = ok(await ACC(env).addCode(await accountFor(env, player, true)));
    return withCookie(json({ code: r.code }), cookie);
  }
  if (b.action === "remove") {
    const player = await mustPlayer(req, env);
    const id = await accountFor(env, player);
    if (!id) throw new Oops("No such save code.", 404);
    ok(await ACC(env).removeCode(id, Number(b.id)));
    return json({ ok: true });
  }
  throw new Oops("Unknown action.");
}

// Type a save code: this device becomes that player (the player it was before stays where it is).
async function loadCode(req, env) {
  const r = ok(await ACC(env).loginCode({ code: (await body(req)).code, ip: ipOf(req) }));
  const { player, cookie } = await enter(req, env, r.accountId);
  return withCookie(json({ name: player.name }), cookie);
}

async function passkey(req, env) {
  const b = await body(req), acc = ACC(env), origin = new URL(req.url).origin;
  if (b.action === "login_options") return json(ok(await acc.passkeyLoginOptions({ origin, ip: ipOf(req) })));
  if (b.action === "login") {
    const r = ok(await acc.passkeyLogin({ origin, ip: ipOf(req), credential: b.credential }));
    const { player, cookie } = await enter(req, env, r.accountId);
    return withCookie(json({ name: player.name }), cookie);
  }
  if (b.action === "register_options" || b.action === "register") {
    const { player, cookie } = await needPlayer(req, env);
    const accountId = await accountFor(env, player, true);
    const r = b.action === "register_options"
      ? await acc.passkeyRegisterOptions({ accountId, origin })
      : await acc.passkeyRegister({ accountId, origin, credential: b.credential, label: b.label });
    return withCookie(json(ok(r)), cookie);
  }
  if (b.action === "remove") {
    const player = await mustPlayer(req, env);
    const id = await accountFor(env, player);
    if (!id) throw new Oops("No such passkey.", 404);
    return json(ok(await acc.passkeyRemove(id, Number(b.id))));
  }
  throw new Oops("Unknown action.");
}

// Log out: this browser forgets its player and goes back to its own (the HOME cookie), if it had one. Only once the
// player has a save code or passkey, so nobody locks themselves out. A device loaded later just loses its session; the
// first device's token is replaced with one nobody has, so that old cookie stops working too.
async function logout(req, env) {
  const player = await findPlayer(req, env);
  if (!player) return withCookie(json({ ok: true }), [clearCookie(COOKIE), clearCookie(HOME)]);
  const id = await accountFor(env, player);
  if (!(id ? await ACC(env).waysIn(id) : 0)) throw new Oops("Make a save code or passkey first, or you'd have no way back in.");
  const h = await sha256(readCookie(req));
  const s = await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(h).run();
  if (!s.meta.changes) await env.DB.prepare("UPDATE players SET token_hash = ? WHERE id = ? AND token_hash = ?").bind(await sha256(newToken()), player.id, h).run();
  // back to this browser's own player if it is still there and still has no account; else the browser starts fresh
  const home = readCookie(req, HOME);
  const hp = home && (await env.DB.prepare("SELECT id FROM players WHERE token_hash = ? AND id != ?").bind(await sha256(home), player.id).first());
  const back = hp && !(await accountFor(env, hp));
  return withCookie(json({ ok: true }), [back ? setCookie(home) : clearCookie(COOKIE), clearCookie(HOME)]);
}
