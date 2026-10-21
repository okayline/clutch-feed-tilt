// CLUTCH FEED TILT. The rules, shared by the page and the tests. Pure functions only: no network, no storage.
//
// Each UTC day has one corridor, the same for everyone. The Worker turns the day into a seed (/api/today);
// corridor(seed) lays out the walls, the enemies' alcoves and when they fire, and who your 4 teammates are.
// label() names a finished run: CLUTCH, FEED or TILT.

export const MW = 7;        // the map is 7 cells wide: walls at x 0-1 and 5-6, the corridor at x 2-4
export const ML = 46;       // and 46 cells long; the far wall is the last row
export const START = 3.0;   // where you start (y)
export const END = 42;      // where the run ends once every enemy is down
export const ENEMIES = 5;   // enemies at the start; your teammates take 2 of them before they fall
export const HP = 3;

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

// Today's corridor from its seed.
//   open[y][x]  true where you can see through (the corridor and its alcoves)
//   enemies     [{ x, y, tx, fire }]: the alcove an enemy waits in, where it steps out to, seconds until it first fires
//   squad       4 teammates: 3 ghosts (other players' runs; names stand in until runs are saved) and BOT_FEEDER
//   t0          when the first teammate event happens (seconds)
export function corridor(seed) {
  const R = rng(seed);
  const open = Array.from({ length: ML }, (_, y) => Array.from({ length: MW }, (_, x) => y < ML - 1 && x >= 2 && x <= 4));
  const side = R() < 0.5 ? 1 : 5, other = 6 - side;
  const spots = [[side, 13 + Math.floor(R() * 3)], [side, 27], [other, 27]];
  for (let y = 6; y < ML - 4; y += 4 + Math.floor(R() * 3)) if (R() < 0.6) open[y][R() < 0.5 ? 1 : 5] = true;  // empty alcoves
  const enemies = spots.map(([x, y]) => {
    open[y][x] = true;
    return { x: x + 0.5, y: y + 0.5, tx: x === 1 ? 2.35 : 4.65, fire: 2.0 + R() * 0.8 };
  });
  const names = [...NAMES];
  const take = () => names.splice(Math.floor(R() * names.length), 1)[0];
  const squad = [take(), take(), take()].map((n) => ({ n, tag: "ghost" })).concat([{ n: "BOT_FEEDER", tag: "bot" }]);
  return { open, enemies, squad, t0: 0.9 + R() * 0.4 };
}

// What a finished run is called. Die and you fed; win while missing far more than you hit and you were tilting;
// otherwise it was a clutch.
export function label({ hp, shots, hits }) {
  if (hp <= 0) return "FEED";
  if (shots > 2.5 * hits) return "TILT";
  return "CLUTCH";
}
