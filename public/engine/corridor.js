// TILT.EXE. The rules, shared by the page and the tests. Pure functions only: no network, no storage.
//
// Each UTC day has one map, the same for everyone. Its wings are the real 4Dungeon floor of that moon quarter
// (level(day)); the day's ledger entry gives the seed (/api/today) that opens its doors. corridor(seed, day) lays out
// the rooms, where you start, the exit door, and the 5 enemies' notches. You walk anywhere on it (WASD) and turn with
// the mouse; the run ends when you walk through the exit, die, or run out of time.
// label() names a finished run: CLUTCH, FEED or TILT.

import FLOOR from "./floor.js";

export const ENEMIES = 5;   // enemies on the map, all yours to shoot
export const HP = 3;
export const S = 7;         // one room of the map is 7 x 7 tiles: walls on its edge, 5 x 5 open inside, doors 3 tiles wide
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
// The run is on RUN_WINGS wings ending with the day's own (or the first two, early in the quarter): you start in the
// first room of the first of them, and the exit is the door into the room behind its last offer (the stairs, on the
// floor's last wing). Only those wings' rooms are built. Locked doors that weren't opened stay wall.
//   floor       the wing generator's floor (for the minimap)
//   level       level(day)
//   route       the room numbers of the shortest way from the first room to the goal, through open doors
//   goal        the room behind the exit; walking into it ends the run
//   open[y][x]  true where you can walk and see through; w x h tiles
//   blocks      [by][bx]: the room each 7 x 7 block of the tile map is (-1 for none)
//   near        { room: [it and the rooms through its doors] }: where an enemy in that room can see you from
//   start       { x, y, a }: where you start (the first room's centre) and the way you face (toward the next room)
//   exit        [[x, y]]: the exit door's tiles, shut until the enemies guarding it are down
//   enemies     [{ x, y, tx, ty, room, guard, fire }]: the notch in a wall an enemy waits in, where it steps out to,
//               its room, whether it guards the exit, and seconds from stepping out until it first fires
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
  // the shortest way through open doors between shown rooms, from the first wing's first room to the goal
  const first = floor.wings[a].rooms[0], prev = { [first]: -1 }, queue = [first];
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
  const blocks = Array.from({ length: h / S }, () => new Array(w / S).fill(-1));
  const corner = (i) => ({ x: (rooms[i].c - c0) * S, y: (rooms[i].r - r0) * S });
  const mid = Math.floor(S / 2);
  const doorTiles = (i, d) => {   // a door, 3 wide, through room i's edge on side d (the next room carves its own)
    const { x, y } = corner(i), [ux, uy] = DIRS[d], out = [];
    for (let k = -1; k <= 1; k++) out.push([x + (ux ? (ux > 0 ? S - 1 : 0) : mid + k), y + (uy ? (uy > 0 ? S - 1 : 0) : mid + k)]);
    return out;
  };
  const near = {};
  for (const i of built) {
    const { x, y } = corner(i);
    blocks[y / S][x / S] = i;
    for (let dy = 1; dy < S - 1; dy++) for (let dx = 1; dx < S - 1; dx++) open[y + dy][x + dx] = true;
    near[i] = [i];
    for (const [d, j] of Object.entries(rooms[i].doors)) {
      if (!shown.has(j)) continue;   // a locked door nobody opened, or a room not in today's wings: wall
      for (const [tx, ty] of doorTiles(i, d)) open[ty][tx] = true;
      near[i].push(j);
    }
  }
  const last = route.length - 1, guard = route[last - 1], c = (i) => ({ x: corner(i).x + S / 2, y: corner(i).y + S / 2 });
  const exit = doorTiles(guard, Object.keys(rooms[guard].doors).find((d) => rooms[guard].doors[d] === goal));
  const s0 = c(route[0]), s1 = c(route[1]);
  const start = { x: s0.x, y: s0.y, a: s1.x > s0.x ? 0 : s1.y > s0.y ? TURN / 4 : s1.x < s0.x ? TURN / 2 : 3 * TURN / 4 };

  // Enemies wait in a notch in a room's wall (a wall with no door) and step out into the room when they see you. Two
  // guard the exit, in the room before it; the other three are dealt to the other rooms (not the first or the goal).
  const spots = (i) => {
    const { x, y } = corner(i), out = [];
    for (const [d, [ux, uy]] of Object.entries(DIRS)) {
      if (shown.has(rooms[i].doors[d])) continue;
      for (const k of [0, -2, 2]) out.push({ nx: x + (ux ? (ux > 0 ? S - 1 : 0) : mid + k), ny: y + (uy ? (uy > 0 ? S - 1 : 0) : mid + k), ux, uy });
    }
    return out;
  };
  const others = built.filter((i) => i !== route[0] && i !== goal && i !== guard);
  for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
  const homes = [guard, guard];
  for (let n = 0; homes.length < ENEMIES; n++) homes.push(others.length ? others[n % others.length] : guard);
  const used = new Set();
  const enemies = [];
  for (const [n, home] of homes.entries()) {
    // the room it was dealt, or if that has no notch left, the first room that has one
    for (const i of [home, guard, ...others]) {
      const sp = spots(i).filter((p) => !used.has(p.nx + "," + p.ny));
      if (!sp.length) continue;
      const p = sp[Math.floor(R() * sp.length)];
      used.add(p.nx + "," + p.ny); open[p.ny][p.nx] = true;
      enemies.push({ x: p.nx + 0.5, y: p.ny + 0.5, tx: p.nx + 0.5 - p.ux * 1.35, ty: p.ny + 0.5 - p.uy * 1.35, room: i, guard: n < 2 && i === guard, fire: 2.0 + R() * 0.8 });
      break;
    }
  }
  return { floor, level: L, route, goal, open, w, h, blocks, near, start, exit, enemies };
}

// The room tile (x, y) is in, or -1.
export function roomOf(cor, x, y) {
  const row = cor.blocks[Math.floor(y / S)];
  return row ? row[Math.floor(x / S)] ?? -1 : -1;
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

// What a finished run is called. Die, or never get out, and you fed; get out while missing far more than you hit and
// you were tilting; otherwise it was a clutch.
export function label({ hp, shots, hits, escaped }) {
  if (hp <= 0 || !escaped) return "FEED";
  if (shots > 2.5 * hits) return "TILT";
  return "CLUTCH";
}

// ---- a run, one tick at a time ------------------------------------------------------------------------------------
// The whole fight is played in fixed ticks, FPS a second, with no clock and no random numbers: the same corridor and
// the same inputs (each at a tick number) always end the same way. The page plays it live; the Worker plays it again
// from the inputs the page sends (replay) and seals what it got, not what the page says it got.
// The inputs, in the order they happened, each [tick, kind, value]:
//   [tick, 0, keys]   the movement keys held from now on: 1 forward (W), 2 back (S), 4 left (A), 8 right (D)
//   [tick, 1, turn]   a turn, in TURN units to the circle (+ is to the right)
//   [tick, 2, row]    a shot at the middle column of the view, on this row (2 decimals)
export const FPS = 15;
export const W = 94, H = 34;          // the view window in half-size characters
export const AIM = W / 2;             // the crosshair's column: the middle of the view
export const AIM_MAX_Y = H - 13;      // the lowest row the crosshair goes (the gun is 11 rows and takes the bottom)
export const COL = (15 * Math.PI / 180) / 21;   // how much further round each column of the view looks: 15 degrees is 21 columns
export const TURN = 4096;             // turn units to the circle
export const WALK = 3 / FPS;          // tiles a tick, walking or strafing
const RAD = 0.22;                     // how close you get to a wall
const SEE = 8;                        // the furthest an enemy sees you from, in tiles
const STEP_TICKS = 7;                 // an enemy steps out of its notch in 7 ticks
const FIRE_TICKS = 25;                // then fires every 25 ticks while it can see you
const REACT_TICKS = 6;                // and once it loses sight of you, it waits at least 6 ticks after it sees you again
const DIE_TICKS = 8;
export const ENEMY_HP = 3, HEAD_DMG = 2;   // body shots to drop an enemy; a headshot counts 2, so chest then head (a double tap) drops it
export const TILT_SEEN = 1.5, TILT_BLIND = 0.25, TILT_HALF = 3;   // tilt (0 to 5) a miss adds: with an enemy on the view, and without; at least that after a miss on view
export const HEAD = 0.22, HEAD_W = 0.2;   // the head: the top 22% of an enemy's rows, its middle 40% of columns (the @ the page draws)
export const MAX_TICKS = 3 * 60 * FPS;    // three minutes: then the run is over, and you didn't get out
export const MAX_SHOTS = 2000;
export const MAX_INPUTS = 12000;

export const ticksOf = (secs) => Math.ceil(secs * FPS - 1e-9);
export const isOpen = (cor, x, y) => x >= 0 && y >= 0 && x < cor.w && y < cor.h && cor.open[y][x];
const shutAt = (R, x, y) => R.shut && R.cor.exit.some(([ex, ey]) => ex === x && ey === y);
// can't walk or see through tile (x, y): a wall, or the exit while it's shut
export const blocked = (R, x, y) => !isOpen(R.cor, x, y) || shutAt(R, x, y);

export function newRun(cor) {
  return {
    cor, tick: 0, x: cor.start.x, y: cor.start.y, a: cor.start.a, keys: 0, shut: true, escaped: false,
    hp: HP, shots: 0, hits: 0, heads: 0, kills: 0, streak: 0, calm: 0, over: false, log: [],
    enemies: cor.enemies.map((e) => ({ ...e, hx: e.x, hy: e.y, state: "hidden", out: 0, dieT: 0, hp: ENEMY_HP, fire: Math.round(e.fire * FPS) })),
  };
}

const dirOf = (a) => sincos(a * 2 * Math.PI / TURN);   // [dy, dx]
export const eyeOf = (R) => { const [dy, dx] = dirOf(R.a); return { x: R.x, y: R.y, dx, dy }; };

// The crosshair shakes while you tilt (2 or more): two zig-zags, a few ticks long each, as wide as the tilt.
const tri = (n, p) => Math.abs(((n % p) / p) * 4 - 2) - 1;
export const jit = (R) => R.streak >= 2 ? (tri(R.tick, 4) + tri(R.tick, 5)) * (Math.min(5, R.streak) - 1) * 0.35 : 0;

// Column x of the view, cast from the eye to the first wall: { d: how far, side, mx, my (the wall block), door (it's
// the shut exit), sx, sy, rdx, rdy }.
export function cast(R, eye, x) {
  const { x: px, y: py, dx: fx, dy: fy } = eye, th = atan2(fy, fx) + (x + 0.5 - W / 2) * COL, [rdy, rdx] = sincos(th);
  let mx = Math.floor(px), my = Math.floor(py);
  const ddx = Math.abs(1 / (rdx || 1e-9)), ddy = Math.abs(1 / (rdy || 1e-9));
  const sx = rdx < 0 ? -1 : 1, sy = rdy < 0 ? -1 : 1;
  let sdx = rdx < 0 ? (px - mx) * ddx : (mx + 1 - px) * ddx, sdy = rdy < 0 ? (py - my) * ddy : (my + 1 - py) * ddy, side = 0;
  for (let i = 0; i < 80; i++) {
    if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
    if (blocked(R, mx, my)) break;
  }
  return { d: side === 0 ? sdx - ddx : sdy - ddy, side, mx, my, door: shutAt(R, mx, my), sx, sy, rdx, rdy };
}

// Can an enemy at (x, y) see you? Only from your room or one next to it (so a tick checks a few enemies, not all),
// within SEE tiles, with nothing in the way: the line between is walked in quarter tiles.
function sees(R, e) {
  if (!R.cor.near[e.room].includes(roomOf(R.cor, R.x, R.y))) return false;
  const dx = R.x - e.x, dy = R.y - e.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d > SEE) return false;
  const n = Math.ceil(d * 4);
  for (let k = 1; k < n; k++) if (blocked(R, Math.floor(e.x + dx * k / n), Math.floor(e.y + dy * k / n))) return false;
  return true;
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

// Walk: the keys held, at WALK a tick, sliding along walls (x and y are tried apart).
function walk(R) {
  const k = R.keys, f = (k & 1 ? 1 : 0) - (k & 2 ? 1 : 0), s = (k & 8 ? 1 : 0) - (k & 4 ? 1 : 0);
  if (!f && !s) return;
  const [dy, dx] = dirOf(R.a), m = (f && s ? Math.SQRT1_2 : 1) * WALK;
  const free = (x, y) => !blocked(R, Math.floor(x - RAD), Math.floor(y - RAD)) && !blocked(R, Math.floor(x + RAD), Math.floor(y - RAD))
    && !blocked(R, Math.floor(x - RAD), Math.floor(y + RAD)) && !blocked(R, Math.floor(x + RAD), Math.floor(y + RAD));
  const nx = R.x + (dx * f - dy * s) * m, ny = R.y + (dy * f + dx * s) * m;
  if (free(nx, R.y)) R.x = nx;
  if (free(R.x, ny)) R.y = ny;
}

// One tick. Returns the things that happened that the page shows: "hurt" when an enemy hit you, "open" when the exit
// opened.
export function tick(R) {
  const ev = [];
  if (R.over) return ev;
  R.tick++;
  walk(R);
  if (roomOf(R.cor, R.x, R.y) === R.cor.goal) { R.escaped = true; R.over = true; return ev; }
  for (const e of R.enemies) {
    if (e.state === "hidden") { if (sees(R, e)) e.state = "stepping"; }
    else if (e.state === "stepping") { e.out = Math.min(1, e.out + 1 / STEP_TICKS); e.x = e.hx + (e.tx - e.hx) * e.out; e.y = e.hy + (e.ty - e.hy) * e.out; if (e.out >= 1) e.state = "out"; }
    else if (e.state === "out") {
      if (!sees(R, e)) e.fire = Math.max(e.fire, REACT_TICKS);
      else if (--e.fire <= 0) {
        e.fire = FIRE_TICKS; R.hp--; ev.push("hurt");
        if (R.hp <= 0) { R.hp = 0; R.over = true; return ev; }
      }
    } else if (e.state === "dying") { if (++e.dieT >= DIE_TICKS) e.state = "dead"; }
  }
  if (R.shut && R.enemies.every((e) => !e.guard || e.state === "dying" || e.state === "dead")) { R.shut = false; ev.push("open"); }
  if (R.tick >= MAX_TICKS) R.over = true;
  return ev;
}

// The movement keys held from now on (a bit each: 1 W, 2 S, 4 A, 8 D). Logged only when they change.
export function press(R, keys) {
  keys &= 15;
  if (R.over || keys === R.keys) return;
  R.keys = keys; R.log.push([R.tick, 0, keys]);
}

// Turn by d TURN units (a whole number; + is to the right). Turns in the same tick are logged as one.
export function turn(R, d) {
  if (R.over || !d) return;
  R.a = (((R.a + d) % TURN) + TURN) % TURN;
  const last = R.log[R.log.length - 1];
  if (last && last[0] === R.tick && last[1] === 1) { last[2] += d; if (!last[2]) R.log.pop(); }
  else R.log.push([R.tick, 1, d]);
}

// Is (col, row) on an enemy's head? Exactly the @ the page draws: its top HEAD of rows, its middle columns (no spare row
// above, as the body has), so far away, where the head is a row or two, a headshot is hard.
export const onHead = (b, c, r) => r >= b.top && r < b.top + HEAD * b.sh && Math.abs((c - b.l) / Math.max(1, b.rr - b.l) - 0.5) < HEAD_W;

// A shot at the middle column of the view, on this row, now. Every shot counts, with or without anything to shoot at.
// Returns false for a shot at nothing, "miss" for a miss with an enemy on the view, "body" or "head" for a hit that
// leaves the enemy up, "kill" for a body shot that drops it, "headkill" for a headshot that drops it, or null if the run
// is over. The row is kept to 2 decimals (that is what the log holds); the log gets [tick, 2, row, hit].
export function fire(R, row) {
  if (R.over) return null;
  row = Math.round(row * 100) / 100;
  R.shots++;
  const c = Math.round(AIM + jit(R)), r = Math.round(row), eye = eyeOf(R);
  const wall = cast(R, eye, Math.max(0, Math.min(W - 1, c))).d;
  const up = R.enemies.filter((e) => e.state === "out" || e.state === "stepping").map((e) => ({ e, b: enemyBox(eye, e) }));
  const hit = up
    .filter(({ b }) => b && c >= b.l - 1 && c <= b.rr && r >= b.top - 1 && r <= b.bot && wall > b.ry)
    .sort((a, b) => a.b.ry - b.b.ry)[0];
  const seen = up.some(({ b }) => b && b.rr >= 0 && b.l < W && wall > b.ry);
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
  R.log.push([R.tick, 2, row, hit ? 1 : 0]);
  return got;
}

// Play a run again from its inputs ([tick, kind, value], in order: see above). Returns the finished run (hp, shots, hits,
// escaped, log), or null if the inputs are not a run: malformed, out of order, or after the run ended. onTick(R), if
// given, is called after every tick (the page uses it to follow a ghost teammate).
export function replay(cor, inputs, onTick) {
  if (!Array.isArray(inputs) || inputs.length > MAX_INPUTS) return null;
  let last = 0, shots = 0;
  for (const s of inputs) {
    if (!Array.isArray(s) || s.length !== 3 || !Number.isInteger(s[0]) || s[0] < last || s[0] > MAX_TICKS) return null;
    const [, k, v] = s;
    if (k === 0 ? !(Number.isInteger(v) && v >= 0 && v <= 15)
      : k === 1 ? !(Number.isInteger(v) && v !== 0 && Math.abs(v) <= 4 * TURN)
      : k === 2 ? !(Number.isFinite(v) && v >= 1 && v <= AIM_MAX_Y && ++shots <= MAX_SHOTS)
      : true) return null;
    last = s[0];
  }
  const R = newRun(cor), step = () => { tick(R); if (onTick) onTick(R); };
  for (const [t, k, v] of inputs) {
    while (!R.over && R.tick < t) step();
    if (R.over) return null;   // an input after the run ended
    if (k === 0) press(R, v); else if (k === 1) turn(R, v); else fire(R, v);
  }
  while (!R.over) step();
  return R;
}
