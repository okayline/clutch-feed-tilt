// TILT.EXE. The rules, shared by the page and the tests. Pure functions only: no network, no storage.
//
// Each UTC day has one map, the same for everyone. Its wings are the real 4Dungeon floor of that moon quarter
// (level(day)); the day's ledger entry gives the seed (/api/today) that opens its doors. corridor(seed, day) lays out the rooms and the rails through them, the enemies' notches and when they fire, and who your
// 4 teammates are.
// label() names a finished run: CLUTCH, FEED or TILT.

import FLOOR from "./floor.js";

export const ENEMIES = 5;   // enemies at the start; your teammates take 2 of them before they fall
export const HP = 3;
export const S = 7;         // one room of the map is 7 x 7 tiles: walls on its edge, 5 x 5 open inside, doors 3 tiles wide
export const TURN_STEPS = 6; // a 90 degree turn happens in 6 jumps of 15 degrees
export const WINGS = 7;     // a whole 4Dungeon floor: 7 wings, as a player who arrives on its first day gets one
export const RUN_WINGS = 2; // the wings one day's run goes through, ending with the day's own wing

// A small seeded random number generator (mulberry32): the same seed always gives the same numbers.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ["zara_k", "mogger99", "lagspike", "gg_ez", "xX_n00b", "tiltproof", "deku_main"];
const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };   // [x, y] on the tile map: y grows going south

// 4Dungeon's moon, copied unchanged: QREF, QLEN and the quarter from daily-dungeon screen.js; hash, seedFrom and the
// level name from daily-dungeon rules.js. A level of 4Dungeon's pit lasts one moon quarter, and every player on it
// that quarter gets the same floor shape, seeded off (the lunar month, the level).
const QREF = Date.UTC(2000, 0, 6, 18, 14), QLEN = 29.530588853 / 4 * 86400000;
const hash = n => { let x = (n * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return x >>> 0; };
const seedFrom = (a, b) => hash((hash(a >>> 0) ^ Math.imul((b >>> 0) + 1, 0x9e3779b1)) >>> 0);
const levelName = h => (h <= 4 ? `B${5 - h}F` : `${h - 4}F`);

// The 4Dungeon level a UTC day ("YYYY-MM-DD") belongs to: the moon quarter at 00:00 UTC that day. name is B4F to B1F;
// seed is its shared floor seed (rules.js arrive()); wing is the day's own wing, one a day from the quarter's first
// UTC day, as 4Dungeon opens one door a day (0 to 6).
export function level(day) {
  const t = Date.parse(day + "T00:00:00Z"), n = Math.floor((t - QREF) / QLEN);
  const q = ((n % 4) + 4) % 4, epoch = Math.floor(n / 4), height = q + 1;
  const wing = Math.min(WINGS - 1, Math.floor(t / 86400000) - Math.floor((QREF + n * QLEN) / 86400000));
  return { name: levelName(height), seed: seedFrom(epoch, height), wing };
}

// The day's map. 4Dungeon's wing generator (engine/floor.js) builds that quarter's floor from its shared seed, and at
// every offer of two locked doors the day's seed opens one, so the whole floor is one a 4Dungeon player could walk.
// The run goes through RUN_WINGS wings ending with the day's own (or the first two, early in the quarter): the
// rails run from the first room of the first of them to the room behind its last offer (the stairs, on the floor's
// last wing), the shortest way through open doors, so they turn wherever the wings turn. Only those wings' rooms are
// drawn. Rooms off the rails (dead ends) stay open to look into. Locked doors that weren't opened stay wall.
//   floor       the wing generator's floor (for the minimap)
//   level       level(day)
//   route       the room numbers along the rails, first to last; room route[i] is centred i * S along them
//   path        [{ x, y }] those rooms' centres on the tile map
//   open[y][x]  true where you can see through; w x h tiles
//   enemies     [{ x, y, tx, ty, s, fire }]: the notch in a wall an enemy waits in, where it steps out to, how far
//               along the rails it is (s), and seconds until it first fires
//   squad       4 teammates: 3 ghosts (other players' runs; names stand in until runs are used) and BOT_FEEDER
//   t0          when the first teammate event happens (seconds)
//   end         how far along the rails the run ends (the last room's centre)
export function corridor(seed, day) {
  const R = rng(seed), L = level(day);
  const floor = FLOOR.generate(L.seed, L.seed, { days: WINGS });
  for (let n = 0; n < 20 && FLOOR.lockedDoors(floor).length; n++) {
    const doors = FLOOR.lockedDoors(floor);
    FLOOR.growDoor(floor, doors[Math.floor(R() * doors.length)]);
  }
  const rooms = floor.rooms, a = Math.max(0, L.wing - (RUN_WINGS - 1)), b = Math.max(RUN_WINGS - 1, L.wing);
  const goal = b + 1 < floor.wings.length ? floor.wings[b + 1].rooms[0] : floor.stairs;
  const shown = new Set([goal, ...floor.wings.slice(a, b + 1).flatMap((w) => w.rooms)]);
  // the rails: the shortest way through open doors between shown rooms, from the first wing's first room to the goal
  const start = floor.wings[a].rooms[0], prev = { [start]: -1 }, queue = [start];
  while (queue.length) {
    const i = queue.shift();
    for (const j of Object.values(rooms[i].doors)) if (shown.has(j) && !(j in prev)) { prev[j] = i; queue.push(j); }
  }
  const route = [];
  for (let i = goal; i !== -1; i = prev[i]) route.unshift(i);

  // the tile map: every shown room, with a room's width of wall all round
  const built = [...shown];
  const r0 = Math.min(...built.map((i) => rooms[i].r)) - 1, c0 = Math.min(...built.map((i) => rooms[i].c)) - 1;
  const w = (Math.max(...built.map((i) => rooms[i].c)) - c0 + 2) * S, h = (Math.max(...built.map((i) => rooms[i].r)) - r0 + 2) * S;
  const open = Array.from({ length: h }, () => new Array(w).fill(false));
  const corner = (i) => ({ x: (rooms[i].c - c0) * S, y: (rooms[i].r - r0) * S });
  const mid = Math.floor(S / 2);
  for (const i of built) {
    const { x, y } = corner(i);
    for (let dy = 1; dy < S - 1; dy++) for (let dx = 1; dx < S - 1; dx++) open[y + dy][x + dx] = true;
    for (const [d, j] of Object.entries(rooms[i].doors)) {
      if (!shown.has(j)) continue;   // a locked door nobody opened, or a room not in today's wings: wall
      const [ux, uy] = DIRS[d];
      for (let k = -1; k <= 1; k++) {   // the door, 3 wide, through this room's edge (the next room carves its own)
        const ex = ux ? (ux > 0 ? S - 1 : 0) : mid + k, ey = uy ? (uy > 0 ? S - 1 : 0) : mid + k;
        open[y + ey][x + ex] = true;
      }
    }
  }
  const path = route.map((i) => ({ x: corner(i).x + S / 2, y: corner(i).y + S / 2 }));

  // Enemies wait in a notch in a room's wall and step out into the room. One alone in an early room (the 2nd or 3rd
  // on the rails), two in the last room. A notch is in a wall with no door, never the one you came in by: on a side
  // wall, 2 tiles past the room's centre; on the far wall, in its middle.
  const travel = (k) => { const a = path[Math.max(0, k - 1)], b = path[Math.max(1, k)]; return [Math.sign(b.x - a.x), Math.sign(b.y - a.y)]; };
  const spots = (k) => {
    const i = route[k], [fx, fy] = travel(k), out = [];
    for (const [d, [ux, uy]] of Object.entries(DIRS)) {
      if (rooms[i].doors[d] !== undefined || (ux === -fx && uy === -fy)) continue;
      const ahead = ux === fx && uy === fy, along = ahead ? mid : 2;
      const lx = ahead ? 0 : ux, ly = ahead ? 0 : uy;                  // the side the notch is on
      const nx = path[k].x - 0.5 + (ahead ? fx * mid : fx * along + lx * mid), ny = path[k].y - 0.5 + (ahead ? fy * mid : fy * along + ly * mid);
      out.push({ nx, ny, ux, uy, s: k * S + along });
    }
    return out;
  };
  const last = route.length - 1;
  const first = [1 + Math.floor(R() * 2), 1, 2, 3].find((k) => k < last && spots(k).length) ?? last;
  const picks = [spots(first)[Math.floor(R() * spots(first).length)], ...spots(last).sort(() => 0).slice(0, 2)];
  if (picks.length < 3) picks.push(spots(last)[0] || picks[0]);
  const enemies = picks.map(({ nx, ny, ux, uy, s }) => {
    open[ny][nx] = true;
    return { x: nx + 0.5, y: ny + 0.5, tx: nx + 0.5 - ux * 1.35, ty: ny + 0.5 - uy * 1.35, s, fire: 2.0 + R() * 0.8 };
  });
  const names = [...NAMES];
  const take = () => names.splice(Math.floor(R() * names.length), 1)[0];
  const squad = [take(), take(), take()].map((n) => ({ n, tag: "ghost" })).concat([{ n: "BOT_FEEDER", tag: "bot" }]);
  return { floor, level: L, route, path, open, w, h, enemies, squad, t0: 0.9 + R() * 0.4, end: last * S };
}

// sin, cos and atan2 worked out with + - * / and Math.sqrt only, so every browser and the Worker get the same bits
// (Math.sin, Math.cos and Math.atan2 may differ in the last digit from one JavaScript engine to another, and a hit
// can turn on that last digit).
const HALF_PI = Math.PI / 2;
export function sincos(x) {   // [sin x, cos x]
  const k = Math.round(x / HALF_PI), r = x - k * HALF_PI, r2 = r * r;
  const sn = r * (1 + r2 * (-1 / 6 + r2 * (1 / 120 + r2 * (-1 / 5040 + r2 * (1 / 362880 + r2 * (-1 / 39916800 + r2 * (1 / 6227020800 + r2 * (-1 / 1307674368000))))))));
  const cs = 1 + r2 * (-1 / 2 + r2 * (1 / 24 + r2 * (-1 / 720 + r2 * (1 / 40320 + r2 * (-1 / 3628800 + r2 * (1 / 479001600 + r2 * (-1 / 87178291200 + r2 / 20922789888000)))))));
  const q = ((k % 4) + 4) % 4;
  return q === 0 ? [sn + 0, cs + 0] : q === 1 ? [cs + 0, -sn + 0] : q === 2 ? [-sn + 0, -cs + 0] : [-cs + 0, sn + 0];
}
function atan(z) {   // |z| <= 1: halve the angle twice, then the series
  for (let i = 0; i < 2; i++) z = z / (1 + Math.sqrt(1 + z * z));
  const z2 = z * z; let p = 0;
  for (let n = 23; n >= 1; n -= 2) p = 1 / n - z2 * p;
  return 4 * z * p;
}
export function atan2(y, x) {
  if (x === 0 && y === 0) return 0;
  if (Math.abs(y) <= Math.abs(x)) { const a = atan(y / x); return x > 0 ? a : y >= 0 ? a + Math.PI : a - Math.PI; }
  const a = atan(x / y); return y > 0 ? HALF_PI - a : -HALF_PI - a;
}

// Where you are on the rails, s tiles along them: { x, y } on the tile map and the way you face, { dx, dy }. You face
// along the rails. At a room where they turn you stop on its centre and turn on the spot: e (0 to 1) is how far round
// you are, in TURN_STEPS jumps of 15 degrees (a stutter, like a low frame rate). Standing on the centre you still face
// the way you came in; once past it, the way out.
export function along(path, s, e = 0) {
  const n = path.length, k = Math.max(0, Math.min(n - 2, Math.ceil(s / S) - 1)), t = Math.max(0, Math.min(1, s / S - k));
  const x = path[k].x + (path[k + 1].x - path[k].x) * t, y = path[k].y + (path[k + 1].y - path[k].y) * t;
  const a = ang(path, k) + (t === 1 && k + 1 <= n - 2 ? turnAt(path, k + 1) * Math.floor(e * TURN_STEPS) / TURN_STEPS : 0);
  const [dy, dx] = sincos(a);
  return { x, y, dx, dy };
}

// The rooms on the route where the rails turn: their indexes in path, in order.
export function turns(path) {
  const out = [];
  for (let j = 1; j < path.length - 1; j++) if (turnAt(path, j)) out.push(j);
  return out;
}

const ang = (path, j) => atan2(path[j + 1].y - path[j].y, path[j + 1].x - path[j].x);
function turnAt(path, j) {
  let turn = ang(path, j) - ang(path, j - 1);
  if (turn > Math.PI) turn -= 2 * Math.PI; if (turn < -Math.PI) turn += 2 * Math.PI;
  return Math.abs(turn) < 1e-9 ? 0 : turn;
}

// What a finished run is called. Die and you fed; win while missing far more than you hit and you were tilting;
// otherwise it was a clutch.
export function label({ hp, shots, hits }) {
  if (hp <= 0) return "FEED";
  if (shots > 2.5 * hits) return "TILT";
  return "CLUTCH";
}

// ---- a run, one tick at a time ------------------------------------------------------------------------------------
// The whole fight is played in fixed ticks, FPS a second, with no clock and no random numbers: the same corridor and
// the same shots (each at a tick number) always end the same way. The page plays it live; the Worker plays it again
// from the shots the page sends (replay) and seals what it got, not what the page says it got.
export const FPS = 15;
export const W = 94, H = 34;          // the view window in half-size characters
export const AIM_MAX_Y = H - 13;      // the lowest row the crosshair goes (the gun is 11 rows and takes the bottom)
export const COL = (15 * Math.PI / 180) / 21;   // how much further round each column of the view looks: 15 degrees is 21 columns
export const TURN_TICKS = 36;         // a turn on the spot: 2.4 seconds
export const SPEED = 1.25 / FPS;      // tiles along the rails per tick
const STEP_TICKS = 7;                 // an enemy steps out of its notch in 7 ticks
const FIRE_TICKS = 25;                // then fires every 25 ticks
const DIE_TICKS = 8;
export const ENEMY_HP = 3, HEAD_DMG = 2;   // body shots to drop an enemy; a headshot counts 2, so chest then head (a double tap) drops it
export const TILT_SEEN = 1.5, TILT_BLIND = 0.25, TILT_HALF = 3;   // tilt (0 to 5) a miss adds: with an enemy on the view, and without; at least that after a miss on view
export const HEAD = 0.22, HEAD_W = 0.2;   // the head: the top 22% of an enemy's rows, its middle 40% of columns (the @ the page draws)
export const MAX_TICKS = 9000;        // ten minutes: no run is longer
export const MAX_SHOTS = 2000;

export const ticksOf = (secs) => Math.ceil(secs * FPS - 1e-9);
export const isOpen = (cor, x, y) => x >= 0 && y >= 0 && x < cor.w && y < cor.h && cor.open[y][x];

export function newRun(cor) {
  return {
    cor, tick: 0, s: 0, tt: 0, hp: HP, shots: 0, hits: 0, heads: 0, kills: 0, streak: 0, calm: 0, phase: "push", over: false, log: [],
    turns: turns(cor.path), clutchTick: ticksOf(cor.t0 + 3.9),   // when the teammates have all fallen and it is 1 v 3
    enemies: cor.enemies.map((e) => ({ ...e, hx: e.x, hy: e.y, state: "hidden", out: 0, dieT: 0, hp: ENEMY_HP, fire: Math.round(e.fire * FPS) })),
  };
}

export const turning = (R) => R.turns.length > 0 && R.s >= R.turns[0] * S;
export const eyeOf = (R) => along(R.cor.path, R.s, turning(R) ? R.tt / TURN_TICKS : 0);

// The crosshair shakes while you tilt (2 or more): two zig-zags, a few ticks long each, as wide as the tilt.
const tri = (n, p) => Math.abs(((n % p) / p) * 4 - 2) - 1;
export const jit = (R) => R.streak >= 2 ? (tri(R.tick, 4) + tri(R.tick, 5)) * (Math.min(5, R.streak) - 1) * 0.35 : 0;

// Column x of the view, cast from the eye to the first wall: { d: how far, side, mx, my (the wall block), sx, sy, rdx, rdy }.
export function cast(cor, eye, x) {
  const { x: px, y: py, dx: fx, dy: fy } = eye, th = atan2(fy, fx) + (x + 0.5 - W / 2) * COL, [rdy, rdx] = sincos(th);
  let mx = Math.floor(px), my = Math.floor(py);
  const ddx = Math.abs(1 / (rdx || 1e-9)), ddy = Math.abs(1 / (rdy || 1e-9));
  const sx = rdx < 0 ? -1 : 1, sy = rdy < 0 ? -1 : 1;
  let sdx = rdx < 0 ? (px - mx) * ddx : (mx + 1 - px) * ddx, sdy = rdy < 0 ? (py - my) * ddy : (my + 1 - py) * ddy, side = 0;
  for (let i = 0; i < 80; i++) {
    if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
    if (!isOpen(cor, mx, my)) break;
  }
  return { d: side === 0 ? sdx - ddx : sdy - ddy, side, mx, my, sx, sy, rdx, rdy };
}

// Where an enemy is on the view: { sxc, ry (how far), l, rr (columns), top, bot (rows), sh }, or null if it can't be seen.
export function enemyBox(eye, e) {
  const { x: px, y: py, dx: fx, dy: fy } = eye, ry = Math.sqrt((e.x - px) * (e.x - px) + (e.y - py) * (e.y - py));
  if (ry < 0.3) return null;
  let da = atan2(e.y - py, e.x - px) - atan2(fy, fx); da -= Math.round(da / (2 * Math.PI)) * 2 * Math.PI;
  if (Math.abs(da) > Math.PI / 2) return null;
  const sxc = W / 2 + da / COL, sw = 0.5 / ry / COL;
  let sh = H * 0.8 / ry;
  if (e.state === "dying") sh *= Math.max(0, 1 - e.dieT / DIE_TICKS);
  if (e.state === "dead" || sh < 1) return null;
  const bot = Math.round(H / 2 + H / (2 * ry)), top = Math.round(bot - sh);
  return { sxc, ry, sh, l: Math.round(sxc - sw / 2), rr: Math.round(sxc + sw / 2), top, bot };
}

// One tick. Returns the things that happened that the page shows: "hurt" when an enemy hit you.
export function tick(R) {
  const ev = [];
  if (R.over) return ev;
  const E = R.enemies, cor = R.cor;
  R.tick++;
  if (R.tick >= R.clutchTick) R.phase = "clutch";
  const active = E.filter((e) => e.state === "stepping" || e.state === "out");
  const next = E.find((e) => e.state === "hidden" && e.s - R.s < 4.2);
  if (next && R.phase !== "push") E.filter((e) => e.state === "hidden" && Math.abs(e.s - next.s) < 2).forEach((e) => e.state = "stepping");
  const stopAt = Math.min(...E.filter((e) => e.state === "hidden").map((e) => e.s - 4.0), cor.end);
  if (!active.length && !next) {
    // walk to the centre of the next room where the rails turn, turn there on the spot, then walk on
    const j = R.turns[0];
    if (turning(R)) { R.tt++; if (R.tt >= TURN_TICKS) { R.turns.shift(); R.tt = 0; R.s = j * S + 1e-6; } }
    else R.s = Math.min(stopAt, j === undefined ? Infinity : j * S, R.s + SPEED);
  }
  for (const e of E) {
    if (e.state === "stepping") { e.out = Math.min(1, e.out + 1 / STEP_TICKS); e.x = e.hx + (e.tx - e.hx) * e.out; e.y = e.hy + (e.ty - e.hy) * e.out; if (e.out >= 1) e.state = "out"; }
    else if (e.state === "out") {
      if (--e.fire <= 0) {
        e.fire = FIRE_TICKS; R.hp--; ev.push("hurt");
        if (R.hp <= 0) { R.hp = 0; R.over = true; return ev; }
      }
    } else if (e.state === "dying") { if (++e.dieT >= DIE_TICKS) e.state = "dead"; }
  }
  if (E.every((e) => e.state === "dead") && R.s >= cor.end - 0.01) R.over = true;
  return ev;
}

// Is (col, row) on an enemy's head? Exactly the @ the page draws: its top HEAD of rows, its middle columns (no spare row
// above, as the body has), so far away, where the head is a row or two, a headshot is hard.
export const onHead = (b, c, r) => r >= b.top && r < b.top + HEAD * b.sh && Math.abs((c - b.l) / Math.max(1, b.rr - b.l) - 0.5) < HEAD_W;

// A shot at (col, row) of the view, now. Every shot counts, with or without anything to shoot at. Returns false for a
// shot at nothing, "miss" for a miss with an enemy on the view, "body" or "head" for a hit that leaves the enemy up, "kill" for a body shot that drops it, "headkill" for a
// headshot that drops it, or null if the run is over. The aim is kept to 2 decimals (that is what the log holds).
export function fire(R, col, row) {
  if (R.over) return null;
  const q = (v) => Math.round(v * 100) / 100;
  col = q(col); row = q(row);
  R.shots++;
  const c = Math.round(col + jit(R)), r = Math.round(row), eye = eyeOf(R);
  const wall = cast(R.cor, eye, Math.max(0, Math.min(W - 1, c))).d;
  const up = R.enemies.filter((e) => e.state === "out" || e.state === "stepping").map((e) => ({ e, b: enemyBox(eye, e) }));
  const hit = up
    .filter(({ b }) => b && c >= b.l - 1 && c <= b.rr && r >= b.top - 1 && r <= b.bot && wall > b.ry)
    .sort((a, b) => a.b.ry - b.b.ry)[0];
  const seen = up.some(({ b }) => b && b.rr >= 0 && b.l < W);
  let got = seen ? "miss" : false;
  if (hit) {
    const head = onHead(hit.b, c, r);
    hit.e.hp -= head ? HEAD_DMG : 1; R.hits++;
    if (head) R.heads++;
    got = hit.e.hp > 0 ? (head ? "head" : "body") : head ? "headkill" : "kill";
    if (hit.e.hp <= 0) { hit.e.state = "dying"; hit.e.dieT = 0; R.kills++; }
    // tilt comes down by half on a hit, and all the way on the second hit in a row
    R.calm++; R.streak = R.calm >= 2 ? 0 : Math.floor(Math.min(5, R.streak) / 2);
  } else {
    // a miss with an enemy on the view tilts you more than a shot at nothing
    // and always leaves the bar at least half full (TILT_HALF of 5)
    R.streak = seen ? Math.max(TILT_HALF, R.streak + TILT_SEEN) : R.streak + TILT_BLIND; R.calm = 0;
  }
  R.log.push([R.tick, col, row, hit ? 1 : 0]);
  return got;
}

// Play a run again from its shots: [[tick, col, row], ...] in order. Returns the finished run (hp, shots, hits, log: one
// [tick, col, row, hit] per shot), or null if the shots are not a run: malformed, out of order, aimed off the view, or the
// run did not end.
export function replay(cor, shots) {
  if (!Array.isArray(shots) || shots.length > MAX_SHOTS) return null;
  let last = 0;
  for (const s of shots) {
    if (!Array.isArray(s) || s.length !== 3 || !Number.isInteger(s[0]) || s[0] < last || s[0] > MAX_TICKS) return null;
    if (!(Number.isFinite(s[1]) && Number.isFinite(s[2]) && s[1] >= 0 && s[1] <= W - 1 && s[2] >= 1 && s[2] <= AIM_MAX_Y)) return null;
    last = s[0];
  }
  const R = newRun(cor);
  for (const [t, col, row] of shots) {
    while (!R.over && R.tick < t) tick(R);
    if (R.over) return null;   // a shot after the run ended
    fire(R, col, row);
  }
  while (!R.over && R.tick < MAX_TICKS) tick(R);
  return R.over ? R : null;
}
