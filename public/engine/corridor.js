// CLUTCH FEED TILT. The rules, shared by the page and the tests. Pure functions only: no network, no storage.
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
export const RUN_WINGS = 3; // the wings one day's run goes through, ending with the day's own wing

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
// The run goes through RUN_WINGS wings ending with the day's own (or the first three, early in the quarter): the
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

// Where you are on the rails, s tiles along them: { x, y } on the tile map and the way you face, { dx, dy }. You face
// along the rails. At a room where they turn you stop on its centre and turn on the spot: e (0 to 1) is how far round
// you are, in TURN_STEPS jumps of 15 degrees (a stutter, like a low frame rate). Standing on the centre you still face
// the way you came in; once past it, the way out.
export function along(path, s, e = 0) {
  const n = path.length, k = Math.max(0, Math.min(n - 2, Math.ceil(s / S) - 1)), t = Math.max(0, Math.min(1, s / S - k));
  const x = path[k].x + (path[k + 1].x - path[k].x) * t, y = path[k].y + (path[k + 1].y - path[k].y) * t;
  const a = ang(path, k) + (t === 1 && k + 1 <= n - 2 ? turnAt(path, k + 1) * Math.floor(e * TURN_STEPS) / TURN_STEPS : 0);
  return { x, y, dx: Math.cos(a), dy: Math.sin(a) };
}

// The rooms on the route where the rails turn: their indexes in path, in order.
export function turns(path) {
  const out = [];
  for (let j = 1; j < path.length - 1; j++) if (turnAt(path, j)) out.push(j);
  return out;
}

const ang = (path, j) => Math.atan2(path[j + 1].y - path[j].y, path[j + 1].x - path[j].x);
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
