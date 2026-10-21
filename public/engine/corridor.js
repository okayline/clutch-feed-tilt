// CLUTCH FEED TILT. The rules, shared by the page and the tests. Pure functions only: no network, no storage.
//
// Each UTC day has one map, the same for everyone. The Worker turns the day into a seed (/api/today);
// corridor(seed) lays out the rooms and the rails through them, the enemies' notches and when they fire, and who your
// 4 teammates are.
// label() names a finished run: CLUTCH, FEED or TILT.

import FLOOR from "./floor.js";

export const ENEMIES = 5;   // enemies at the start; your teammates take 2 of them before they fall
export const HP = 3;
export const S = 7;         // one room of the map is 7 x 7 tiles: walls on its edge, 5 x 5 open inside, doors 3 tiles wide
export const DAYS = 3;      // floor.generate's days: 4 wings of 4Dungeon's wing generator (engine/floor.js)

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

// Today's map from its seed. 4Dungeon's wing generator (engine/floor.js, copied unchanged from irl-dungeon) lays out
// the wings; at every offer of two locked doors the seed opens one. The rails run from the first room to the stairs
// room through open doors (the shortest way), so they turn wherever the wings turn. Rooms off the rails (dead ends)
// stay open to look into. Locked doors that weren't opened stay wall.
//   floor       the wing generator's floor (for the minimap)
//   route       the room numbers along the rails, first to last; room route[i] is centred i * S along them
//   path        [{ x, y }] those rooms' centres on the tile map
//   open[y][x]  true where you can see through; w x h tiles
//   enemies     [{ x, y, tx, ty, s, fire }]: the notch in a wall an enemy waits in, where it steps out to, how far
//               along the rails it is (s), and seconds until it first fires
//   squad       4 teammates: 3 ghosts (other players' runs; names stand in until runs are used) and BOT_FEEDER
//   t0          when the first teammate event happens (seconds)
//   end         how far along the rails the run ends (the last room's centre)
export function corridor(seed) {
  const R = rng(seed);
  const floor = FLOOR.generate(seed, seed, { days: DAYS });
  for (let n = 0; n < 20 && FLOOR.lockedDoors(floor).length; n++) {
    const doors = FLOOR.lockedDoors(floor);
    FLOOR.growDoor(floor, doors[Math.floor(R() * doors.length)]);
  }
  const rooms = floor.rooms;
  // the rails: the shortest way through open doors from the first room to the stairs
  const prev = { 0: -1 }, queue = [0];
  while (queue.length) {
    const i = queue.shift();
    for (const j of Object.values(rooms[i].doors)) if (rooms[j] && !(j in prev)) { prev[j] = i; queue.push(j); }
  }
  const route = [];
  for (let i = floor.stairs; i !== -1; i = prev[i]) route.unshift(i);

  // the tile map: every built room, with a room's width of wall all round
  const built = rooms.map((r, i) => r && i).filter((i) => i !== false && i !== undefined);
  const r0 = Math.min(...built.map((i) => rooms[i].r)) - 1, c0 = Math.min(...built.map((i) => rooms[i].c)) - 1;
  const w = (Math.max(...built.map((i) => rooms[i].c)) - c0 + 2) * S, h = (Math.max(...built.map((i) => rooms[i].r)) - r0 + 2) * S;
  const open = Array.from({ length: h }, () => new Array(w).fill(false));
  const corner = (i) => ({ x: (rooms[i].c - c0) * S, y: (rooms[i].r - r0) * S });
  const mid = Math.floor(S / 2);
  for (const i of built) {
    const { x, y } = corner(i);
    for (let dy = 1; dy < S - 1; dy++) for (let dx = 1; dx < S - 1; dx++) open[y + dy][x + dx] = true;
    for (const [d, j] of Object.entries(rooms[i].doors)) {
      if (!rooms[j]) continue;   // a locked door nobody opened: wall
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
  return { floor, route, path, open, w, h, enemies, squad, t0: 0.9 + R() * 0.4, end: last * S };
}

// Where you are on the rails, s tiles along them: { x, y } on the tile map and the way you face, { dx, dy }. You face
// along the rails, and at a room where they turn you turn with them, smoothly, over the 3 tiles around its centre.
export function along(path, s) {
  const n = path.length, k = Math.max(0, Math.min(n - 2, Math.floor(s / S))), t = Math.max(0, Math.min(1, s / S - k));
  const x = path[k].x + (path[k + 1].x - path[k].x) * t, y = path[k].y + (path[k + 1].y - path[k].y) * t;
  const ang = (j) => Math.atan2(path[j + 1].y - path[j].y, path[j + 1].x - path[j].x);
  let a = ang(k);
  for (const j of [k, k + 1]) {   // the turns at either end of this stretch
    if (j < 1 || j > n - 2 || Math.abs(s - j * S) >= 1.5) continue;
    const u = (s - j * S + 1.5) / 3, e = u * u * (3 - 2 * u);
    let turn = ang(j) - ang(j - 1);
    if (turn > Math.PI) turn -= 2 * Math.PI; if (turn < -Math.PI) turn += 2 * Math.PI;
    a = ang(j - 1) + turn * e;
  }
  return { x, y, dx: Math.cos(a), dy: Math.sin(a) };
}

// What a finished run is called. Die and you fed; win while missing far more than you hit and you were tilting;
// otherwise it was a clutch.
export function label({ hp, shots, hits }) {
  if (hp <= 0) return "FEED";
  if (shots > 2.5 * hits) return "TILT";
  return "CLUTCH";
}
