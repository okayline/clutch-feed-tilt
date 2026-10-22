// The page: draws the frame and the view, runs the fight, and names the run. The rules are in engine/corridor.js.
import * as C from "./engine/corridor.js";
import FLOOR from "./engine/floor.js";
import { VERSION } from "./engine/version.js";
import { setupAccount, openPlayer, closePlayer, isOpen as userOpen } from "./account.js";
import { setupLedger, openLedger, closeLedger, isOpen as ledgerOpen } from "./ledger.js";

const W = C.W, H = C.H;              // the view window at half-size characters: 47 x 17 cells of the frame, doubled
const FW = 80, PW = 30, VWc = 47;
const $ = (id) => document.getElementById(id);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// the gun, at the bottom middle of the view (drawn in render()): a Glock 17 from behind and a little above, as you'd
// hold it. Worked out from its real size (slide 186 x 25.5 x 30 mm) seen from 15 cm behind it: the top of the slide
// shows as 3 rows narrowing to under half its width at the front, with the front sight post there and lines running
// along it from the rear sight's notch and its sides toward the front; the rear sight
// (two white dots, the notch between) across its back edge; then the back of the slide (its cover plate), the frame and
// the top of the textured grip.
const GUN_SWING = 8;    // the most the gun moves left or right, in cells
const GUN = [
  "      _.||._      ",
  "     /:|  |:\\     ",
  "    /: |  | :\\    ",
  "  _/_o_|  |_o_\\_  ",
  " |==============| ",
  " |  __________  | ",
  " | |          | | ",
  " | |__________| | ",
  " |______________| ",
  "   |__________|   ",
  "    |########|    ",
];

const reloadFrame = () => !P || !(P.reload > 0) ? 0 : P.reload > C.RELOAD_TICKS / 2 ? 1 : 2;

let day = "", SEED = 0, WING = 0, myName = null, GHOSTS = [];
let cor, enemies, squad, feed, P, lag = 0;

// ---- a run --------------------------------------------------------------------------------------------------
function build() {
  cor = C.corridor(SEED, day, WING);
  // the fight itself (where you are, HP, shots, enemies) is the engine's run (corridor.js newRun); the rest is the page's
  P = Object.assign(C.newRun(cor), { aimY: H / 2 - 1, sway: 0, jit: 0, flash: 0, gibs: [], hurt: 0, left: C.ENEMIES, done: null, seen: [cor.route[0]] });
  enemies = P.enemies; lag = 0; turnLeft = 0;
  // Ghost teammates: other players' sealed runs today (/api/today ghosts), played again here (corridor.js replay) to
  // get where they were on every tick. They walk beside you; what they did is told in the kill feed as it happens.
  squad = GHOSTS.map((g) => {
    const track = [];
    const R = C.replay(cor, g.inputs, (r) => track.push({ x: r.x, y: r.y, hp: r.hp, k: r.kills, over: r.over, out: r.escaped }));
    return R && track.length ? { n: g.name, track } : null;
  }).filter(Boolean);
  feed = [];
}
function say(t, c) { feed.push([t.slice(0, 77), c]); if (feed.length > 3) feed.shift(); }

// a ghost on this tick of your run (its last tick once its run is over)
const ghostAt = (m) => m.track[Math.max(0, Math.min(m.track.length, P.done ? Infinity : P.tick) - 1)];

// ---- drawing the view ---------------------------------------------------------------------------------------
// Enemies glitch: each frame a few of their cells show a scrambled glyph, like a demon's words decoding in 4Dungeon
// (daily-dungeon index.html VOICE_GLYPHS, less the @ so only a head is ever an @). Only the drawing: a shot is still
// checked against corridor.js cell().
const WIPE = 1.2;   // seconds a downed enemy takes to be wiped out (drawing only; the engine has it down at once)
const SPIN_TICKS = 3;   // a drone's rotors turn every 3 frames
const GLITCH_GLYPHS = "#%!&$*?/\\<>=+~", GLITCH = { short: 0.25, tall: 0.25, drone: 0.1 }, GLITCH_HOLD = 2;   // a drone glitches less; a scrambled glyph stays 2 frames
// a number from 0 to 1 for a cell and a moment, the same all through one GLITCH_HOLD
const noise = (x, y, t) => { let h = Math.imul(x * 374761393 + y * 668265263 + t * 2246822519, 3266489917); h ^= h >>> 15; h = Math.imul(h, 2654435761); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
// Dying, as Doom does it (p_user.c P_DeathThink, "fall on your face"): the view sinks to the floor and turns to face the
// nearest enemy, red; then the view melts down the screen in columns, each after its own short delay with its neighbours
// close behind (Doom's screen melt, f_wipe.c), digital: a band of red glitch at each column's top edge, and FRAGGED
// underneath. Drawing only: the run was over the moment you died. Then the FEED banner. Skipped with Reduce Motion.
const FALL = 0.8, MELT_AT = 1.8, SINK = 0.42;   // fall for 0.8 s, lie there a beat (1 s), then melt, at half speed
const dying = () => P && P.deathT !== undefined;
const eye = () => { if (!dying()) return C.eyeOf(P); const [dy, dx] = C.sincos(P.viewA); return { x: P.x, y: P.y, dx, dy }; };
// The screen melt, Doom's way between scenes (f_wipe.c): the old picture slides down off the view in columns, each after
// its own short delay with its neighbours close behind, uncovering the new one; digital here, with a band of red glitch
// along each column's top edge. Used when the corridor first shows (off a title card), on Run It Back (off the last
// frame), when you get out (onto YOU GOT OUT) and when you die (onto FRAGGED). The fight waits while it runs. Drawing only;
// skipped with Reduce Motion.
let wipe = null;   // { oldCh, oldCl, card (what it uncovers; none: the live view), t, d (each column's delay), then }
const MELT_SPEED = H / 1.1;   // rows a second
function meltDelays() {
  const d = [];
  for (let x = 0, v = Math.random() * 0.2; x < W; x++) { v = Math.max(0, Math.min(0.35, v + (Math.random() - 0.5) * 0.05)); d.push(v); }
  return d;
}
function card(lines) {   // [[text, class], ...] centred down the middle of a blank view
  const c = { ch: Array.from({ length: H }, () => new Array(W).fill(" ")), cl: Array.from({ length: H }, () => new Array(W).fill("")) };
  lines.forEach(([t, k], i) => { const y = Math.floor(H / 2 - lines.length / 2) + i, x0 = Math.floor(W / 2 - t.length / 2); [...t].forEach((ch, j) => { c.ch[y][x0 + j] = ch; c.cl[y][x0 + j] = ch === " " ? "" : k; }); });
  return c;
}
function startWipe(old, cardOf, then, speed = MELT_SPEED) {
  if (reduced) { if (then) then(); return; }
  wipe = { oldCh: old && old.ch, oldCl: old && old.cl, card: cardOf, t: 0, d: meltDelays(), then, speed };
}
const snapshot = () => ({ ch: ch.map((r) => r.slice()), cl: cl.map((r) => r.slice()) });
// draw the melt over what render() put in ch and cl; true when every column is off the bottom
function drawWipe() {
  if (!wipe.oldCh) Object.assign(wipe, { oldCh: snapshot().ch, oldCl: snapshot().cl });   // melt the view as it is now
  const nu = wipe.card || snapshot(), g = Math.floor(wipe.t * C.FPS);
  let done = true;
  for (let x = 0; x < W; x++) {
    const o = Math.max(0, Math.floor((wipe.t - wipe.d[x]) * wipe.speed));
    if (o < H) done = false;
    for (let y = 0; y < H; y++) {
      if (y >= o) { ch[y][x] = wipe.oldCh[y - o][x]; cl[y][x] = wipe.oldCl[y - o][x]; }
      else if (y >= o - 2) { ch[y][x] = GLITCH_GLYPHS[Math.floor(noise(x, y, g) * GLITCH_GLYPHS.length)]; cl[y][x] = "e"; }
      else { ch[y][x] = nu.ch[y][x]; cl[y][x] = nu.cl[y][x]; }
    }
  }
  return done;
}
const eyeH = () => dying() ? 0.5 - SINK * Math.min(1, P.deathT / FALL) ** 0.6 : 0.5;   // how high your eye is off the floor, in wall heights
const ch = Array.from({ length: H }, () => new Array(W).fill(" "));
const cl = Array.from({ length: H }, () => new Array(W).fill(""));
const zbuf = new Float64Array(W);
const TALL = 2;
const GATE = 0.9;  // the exit's holo gate is this far above your eye, the floor being 0.5 below it   // a wall is twice as high as the floor-to-eye-and-back it was, so there is a ceiling above you
const put = (x, y, c, k) => { if (x >= 0 && x < W && y >= 0 && y < H) { ch[y][x] = c; cl[y][x] = k; } };

function render() {
  for (let y = 0; y < H; y++) { ch[y].fill(" "); cl[y].fill(""); }
  // the camera: where you stand, the way you face. Each column looks COL further round than the one to its left and the
  // walls are as tall as they are near, not as the ray is deep, so turning slides the picture sideways and changes
  // nothing else: 15 degrees moves it exactly 21 columns.
  const E = eye(), { x: px, y: py } = E, EH = eyeH();
  // Walls are outlines, as 4Dungeon draws them (daily-dungeon screen.js renderView), with no horizontal lines: a wall's
  // top and bottom edges are a \ or / where they slope away from you and nothing where they run flat, an upright |
  // marks every corner (where one flat stretch of wall meets another, or ends against one further away), and a wall
  // facing you has an upright | at the edge of every block in it. A door is filled.
  // First every column's ray (the same one the engine uses to tell whether a shot hits a wall first, corridor.js cast),
  // since an edge's slope needs the columns either side.
  const hits = [];
  for (let x = 0; x < W; x++) {
    const h = C.cast(P, E, x), { d, side, mx, my, sx, sy } = h;
    zbuf[x] = d;
    // a panel is one face of one wall block; how near its middle is sets how bright it is
    const fcx = side === 0 ? mx + (sx < 0 ? 1 : 0) : mx + 0.5, fcy = side === 0 ? my + 0.5 : my + (sy < 0 ? 1 : 0);
    h.pd = Math.max(0.3, Math.hypot(fcx - px, fcy - py)); h.id = mx + "," + my + "," + side;
    // the flat stretch of wall it is on: the grid line its face lies along, and how far along that line it was hit. A
    // run of blocks side by side is one stretch, drawn as one wall with no | between its blocks; a door is its own.
    // the shut exit is a holo gate in the middle tile of its 3; the tiles either side of it are plain wall
    h.gate = h.door && mx === cor.exit[1][0] && my === cor.exit[1][1];
    h.line = side + "," + (side === 0 ? mx + (sx < 0 ? 1 : 0) : my + (sy < 0 ? 1 : 0)) + "," + (h.gate ? "x" : h.locked ? "l" : "");
    h.at = side === 0 ? py + d * h.rdy : px + d * h.rdx;
    // its top and bottom, unrounded: each column is as tall as the wall is near along its ray, so a wall beside you
    // narrows away. A wall is TALL times as high as you see from the floor up to your eye and back down, standing on the
    // same floor as the enemies (corridor.js enemyBox), so it rises above you to the ceiling.
    h.t = H / 2 - (TALL - EH) * H / Math.max(0.3, d); h.b = H / 2 + EH * H / Math.max(0.3, d);
    hits.push(h);
  }
  // are columns x and x + 1 on the same stretch of wall?
  const joined = (x) => x >= 0 && x + 1 < W && hits[x].line === hits[x + 1].line && Math.abs(hits[x].at - hits[x + 1].at) < 3;   // (far down a side wall, one column to the next can be over a tile apart)
  for (let x = 0; x < W; x++) {
    const { d, side, gate, locked, rdx, rdy, pd, t, b } = hits[x], top = Math.round(t), bot = Math.round(b);
    const k = pd > 14 ? "d" : pd > 7 ? "t" : "";
    // where the top edge crosses into this column and out of it: halfway to the columns either side on the same stretch
    const tl = joined(x - 1) ? (hits[x - 1].t + t) / 2 : t, tr = joined(x) ? (hits[x + 1].t + t) / 2 : t;
    const bl = joined(x - 1) ? (hits[x - 1].b + b) / 2 : b, br = joined(x) ? (hits[x + 1].b + b) / 2 : b;
    const sideOn = (side === 0 ? Math.abs(rdx) : Math.abs(rdy)) <= 0.8;   // a side wall, running away from you
    // a corner between this column and the one to its left: the | goes on the nearer of the two, all the way up it
    const edge = x > 0 && hits[x - 1].d < d ? x - 1 : x;
    const corner = x > 0 && !joined(x - 1);
    if (corner) { const e = hits[edge]; for (let y = Math.max(0, Math.round(e.t)); y < Math.min(H, Math.round(e.b)); y++) put(edge, y, "|", e.pd > 14 ? "d" : e.pd > 7 ? "t" : ""); }
    for (let y = Math.max(0, top); y < Math.min(H, bot); y++) {
      if (ch[y][x] === "|") continue;   // a corner drawn from the column to the right
      // a locked door: # all over, as the minimap marks it
      else if (locked) put(x, y, "#", k);
      // a wall facing you (its ray within about 37 degrees of straight on): an upright | at the edge of every block in it
      else if (!sideOn && x > 0 && hits[x - 1].id !== hits[x].id) put(x, y, "|", k);
    }
    // the exit, while it's shut: a holo gate a little over head height: a bright post at each side and a field of
    // flickering : ' . running down between them, as if it were falling
    if (gate) {
      const gt = Math.max(0, Math.round(H / 2 - GATE * H / Math.max(0.3, d))), post = !(x > 0 && hits[x - 1].gate) || !(x + 1 < W && hits[x + 1].gate);
      for (let y = gt; y < Math.min(H, bot); y++) {
        if (post) { put(x, y, "|", "b"); continue; }
        const c = " :'."[(((y - Math.floor(P.tick / 2) - Math.floor(noise(x, 0, 0) * 4)) % 4) + 4) % 4];   // each column falls out of step with the next
        put(x, y, c, c === " " ? "" : "t");
      }
    }
    // a side wall's edge is one unbroken line: a column it crosses no row in still gets its \ or /, on the row it runs
    // along, unless it slopes under 1 row in 4 columns (that would be a flat run of them); a wall facing you keeps its
    // flat edge undrawn
    // (the top edge, then the bottom one; each is a \ where it falls to the right and a / where it rises)
    for (const [l, r] of [[tl, tr], [bl, br]]) {
      const y0 = Math.round(Math.min(l, r)), y1 = Math.round(Math.max(l, r)), c = r > l ? "\\" : "/", mid = Math.floor((l + r) / 2);
      const [ya, yb] = y1 > y0 ? [y0, y1] : sideOn && Math.abs(r - l) >= 0.25 ? [mid, mid + 1] : [0, 0];
      for (let y = ya; y < yb; y++) put(x, y, c, k);
    }
    // the floor grid: only the lines running the way you face, so nothing scrolls toward you as you walk ahead
    for (let y = Math.max(bot, H / 2 + 1); y < H; y++) {
      const rd = EH * H / (y + 0.5 - H / 2); if (rd >= d) continue;
      const wv = Math.abs(E.dx) < Math.abs(E.dy) ? px + rd * rdx : py + rd * rdy, fr = wv - Math.floor(wv);
      if (fr < 0.05) put(x, y, ".", rd > 6 ? "d" : "t");
    }
    // the ceiling: the same lines, overhead, where the walls' tops meet it
    for (let y = Math.min(top, H / 2 - 1) - 1; y >= 0; y--) {
      const rd = (TALL - EH) * H / (H / 2 - y - 0.5); if (rd >= d) continue;
      const wv = Math.abs(E.dx) < Math.abs(E.dy) ? px + rd * rdx : py + rd * rdy, fr = wv - Math.floor(wv);
      if (fr < 0.05) put(x, y, ".", rd > 6 ? "d" : "t");
    }
  }
  // enemies, far to near
  // the same boxes and shapes the engine checks a shot against (corridor.js enemyBox, cell)
  // and ghost teammates, drawn in the ghost colour with an o for a head
  const ghosts = squad.map((m) => ghostAt(m)).filter((g) => !g.over).map((g) => ({ x: g.x, y: g.y, state: "ghost", kind: "ghost" }));
  // a downed enemy is wiped out digitally over WIPE seconds: drawn at full size (not the engine's shrinking box), its rows
  // erased from the top down behind a band of glitch, the rest glitching more and more. Drawing only.
  const wipeOf = (e) => e.diedAt === undefined ? -1 : (P.tick - e.diedAt) / (WIPE * C.FPS);
  const vis = [...enemies.filter((e) => e.state !== "hidden" || Math.hypot(e.x - P.x, e.y - P.y) < 9), ...ghosts]
    .map((e) => [e, wipeOf(e) >= 1 ? null : C.enemyBox(E, wipeOf(e) >= 0 ? { ...e, state: "out" } : e)]).filter(([, b]) => b).sort((a, b) => b[1].ry - a[1].ry);
  for (const [e, b0] of vis) {
    const lift = Math.round((0.5 - EH) * H / b0["ry"]), b = lift ? { ...b0, top: b0.top - lift, bot: b0.bot - lift } : b0;   // a lower eye sees them higher
    const { sxc, ry, l, rr, top, bot } = b, k = e.state === "ghost" ? "h" : "e";
    for (let x = Math.max(0, l); x < Math.min(W, rr); x++) {
      if (zbuf[x] < ry) continue;
      for (let y = Math.max(0, top); y < Math.min(H, bot); y++) {
        let c = C.cell(b, x, y, Math.floor(P.tick / SPIN_TICKS)), kk = k;
        const w = wipeOf(e), t = Math.floor(P.tick / GLITCH_HOLD);
        if (c && w >= 0) {   // being wiped: gone above the line, a bright glitch band at it, glitching below
          const f = (y - b.top) / Math.max(1, b.bot - b.top);
          if (f < w) c = "";
          else if (f < w + 0.18) { c = GLITCH_GLYPHS[Math.floor(noise(y, x, t + 7) * GLITCH_GLYPHS.length)]; kk = "g"; }
          else if (noise(x, y, t) < 0.3 + 0.6 * w) c = GLITCH_GLYPHS[Math.floor(noise(y, x, t + 7) * GLITCH_GLYPHS.length)];
        }
        else if (c === "@" && k === "h") c = "o";
        else if (c && k === "e") { if (noise(x, y, t) < GLITCH[b.kind]) c = GLITCH_GLYPHS[Math.floor(noise(y, x, t + 7) * GLITCH_GLYPHS.length)]; }
        if (c) put(x, y, c, kk);
      }
    }
    if (e.state === "out" && e.fire < 0.7 * C.FPS && Math.floor(P.tick / C.FPS * 8) % 2 === 0) put(Math.round(sxc), top - 1, "!", "g");
  }
  // a chunk: 2 or 3 cells wide, 1 or 2 tall, glitching like the enemies (half its cells a scrambled glyph, each held GLITCH_HOLD frames)
  const gt = Math.floor(P.tick / GLITCH_HOLD);
  P.gibs.forEach((g, n) => { for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) {
    const c = noise(n * 7 + i, j, gt) < 0.5 ? GLITCH_GLYPHS[Math.floor(noise(j, n * 7 + i, gt + 7) * GLITCH_GLYPHS.length)] : g.c;
    put(Math.round(g.x) + i, Math.round(g.y) + j, c, g.t > GIB_LIFE / 3 ? "e" : "d");
  } });
  // crosshair, in the middle column (corridor.js AIM): you turn to aim, and move it up and down
  const ax = Math.round(C.AIM + P.jit), ay = Math.round(P.aimY);
  if (!P.done && !dying()) {
    put(ax - 2, ay, "-", "b"); put(ax - 1, ay, "-", "b"); put(ax + 1, ay, "-", "b"); put(ax + 2, ay, "-", "b");
    put(ax, ay, P.flash > 0 ? "*" : "+", P.flash > 0 ? "g" : "b"); put(ax, ay - 1, "|", "b"); put(ax, ay + 1, "|", "b");
  }
  // the gun: one rigid piece at the bottom middle, swaying out the way you turn along a small arc (one row lower once it
  // is more than halfway out to the side) and kicking down a row when it fires. P.sway eases back to 0 in step().
  const lean = Math.max(-GUN_SWING, Math.min(GUN_SWING, P.sway));
  const rf = reloadFrame();
  const gx = Math.round(W / 2 - GUN[0].length / 2 + lean) + [0, 10, 5][rf], gy = H - GUN.length + (Math.abs(lean) > GUN_SWING / 2 ? 1 : 0) + (P.flash > 0 ? 1 : 0) + [0, 4, 2][rf] + (dying() ? Math.round(Math.min(1, P.deathT / FALL) * (GUN.length + 1)) : 0);
  // reloading: two frames. First the gun swings off to the right and drops 4 rows, the grip empty, and the old magazine
  // falls away on its left; then it comes halfway back, 2 rows down, with a full magazine coming up on its left. RELOADING
  // blinks above it the whole time.
  const magOut = rf === 1;
  if (rf) {
    const fall = Math.round((1 - P.reload / C.RELOAD_TICKS) * 12);
    const mag = rf === 1 ? ["[  ]", "[  ]", "[__]"] : ["[##]", "[##]", "[##]"];
    const mx = gx - 6, my = rf === 1 ? H - 9 + fall : H - 1 - Math.max(0, fall - 6);
    mag.forEach((row, i) => [...row].forEach((ch, k) => put(mx + k, my + i, ch, rf === 1 ? "d" : "t")));
    if (Math.floor(P.tick / 3) % 2 === 0) [..."RELOADING"].forEach((ch, k) => put(Math.round(W / 2) - 4 + k, H - GUN.length - 2, ch, "g"));
  }
  GUN.forEach((s, i) => { for (let k = s.search(/\S/); k <= s.search(/\S\s*$/); k++) put(gx + k, gy + i, magOut && s[k] === "#" ? " " : s[k], P.flash > 0 && i < 4 ? "g" : "t"); });   // solid: the gaps inside it hide what is behind

  if (dying()) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ch[y][x] !== " ") cl[y][x] = "e";   // red while you fall
  if (wipe && drawWipe()) wipe.done = true;
  let out = "";
  for (let y = 0; y < H; y++) {
    let run = "", k = cl[y][0];
    for (let x = 0; x < W; x++) {
      if (cl[y][x] !== k) { out += k ? `<span class="${k}">${run}</span>` : run; run = ""; k = cl[y][x]; }
      run += ch[y][x];
    }
    out += (k ? `<span class="${k}">${run}</span>` : run) + "\n";
  }
  $("screen").innerHTML = out;
}

let frameHTML = "";
const setFrame = (h) => { if (h !== frameHTML) $("frame").innerHTML = frameHTML = h; };

// ---- the frame and panel ------------------------------------------------------------------------------------
const pad = (s, n) => s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
function seg(parts, n) {   // [[text, cls], ...] padded to n visible columns
  let len = 0, html = "";
  for (const [t, c, k] of parts) {
    const tt = t.slice(0, n - len); len += tt.length;
    html += c || k ? `<span${c ? ` class="${c}"` : ""}${k ? ` data-k="${k}"` : ""}>${esc(tt)}</span>` : esc(tt);
  }
  return html + " ".repeat(Math.max(0, n - len));
}
function frame(message) {
  const top = "+" + "=".repeat(FW - 2) + "+";
  const mid = "+" + "=".repeat(VWc) + "+" + "=".repeat(PW) + "+";
  const dash = "+" + "-".repeat(FW - 2) + "+";
  // the day's 4Dungeon level and wing (corridor.js level), so you can tell which floor today's corridor is
  const lv = day ? C.level(day) : null;
  const head = seg([[" TILT.EXE", "b"], ["                           ", ""], [lv ? `${day}  4DUNGEON ${lv.name} WING ${WING}` : "", "t"],
                    [day ? `  SEED ${SEED.toString(16).toUpperCase().padStart(8, "0").slice(0, 4)}` : "", "d"]], FW - 2);
  if (message) {
    const L = [top, "|" + head + "|", mid];
    for (let i = 0; i < 17; i++) L.push("|" + " ".repeat(VWc) + "|" + " ".repeat(PW) + "|");
    L.push(top, ...[" " + message, "", ""].map((t) => "|" + seg([[t, "t"]], FW - 2) + "|"), dash, "|" + " ".repeat(FW - 2) + "|", top);
    setFrame(L.join("\n"));
    return;
  }
  const rule = " " + "-".repeat(PW - 2) + " ";
  const hpBar = "[" + "#".repeat(P.hp) + " ".repeat(C.HP - P.hp) + "]";
  const tilt = Math.floor(Math.min(5, P.streak));
  const secs = P.tick / C.FPS, time = `${Math.floor(secs / 60)}:${(secs % 60).toFixed(1).padStart(4, "0")}`;
  const acc = P.shots ? Math.round(100 * P.hits / P.shots) : 0;
  const rows = [
    [[" SQUAD", ""], ["            HP    K", "t"]],
    [[rule, "d"]],
    [[" " + pad(myName || "YOU", 15).slice(0, 15), "b"], [hpBar, P.hp > 1 ? "b" : "e"], ["  ", ""], [String(P.kills ?? "-"), "b"]],
    // ghost teammates (up to 3), then blank rows so the minimap stays put
    ...[0, 1, 2, 3].map((i) => {
      const m = squad[i];
      if (!m) return i === 0 && !squad.length ? [[" NO GHOSTS YET TODAY", "d"]] : [[""]];
      const g = ghostAt(m), dead = g.over && !g.out;
      return [[" " + pad(m.n, 10), dead ? "d" : "h"], [" ghost", "d"], [" ", ""],
              [dead ? "DEAD " : g.out ? "OUT  " : "[" + "#".repeat(g.hp) + " ".repeat(C.HP - g.hp) + "]", dead ? "e" : "t"], ["  " + g.k, dead ? "d" : "t"]];
    }),
    [[rule, "d"]],
    [[""]],
    ...minimap().map((line) => line.split("@").flatMap((part, i) => i ? [["@", "b"], [part, "t"]] : [[" " + part, "t"]])),
    [[rule, "d"]],
    [[` SHOTS ${String(P.shots).padStart(2, "0")}  HITS ${String(P.hits).padStart(2, "0")}  ACC ${String(acc).padStart(3)}%`, "t"]],
    [[" TILT ", "t"], ["[" + "#".repeat(tilt) + ".".repeat(5 - tilt) + "]", tilt >= 3 ? "e" : tilt ? "g" : "d"], ["  " + time, "t"], ["  " + (P.reload > 0 ? "RELOAD" : P.ammo + "/" + C.MAG), P.reload > 0 ? "e" : P.ammo <= 3 ? "g" : "t"]],
  ];
  const over = userOpen() || ledgerOpen();   // a panel covers the 3D view and the run waits
  const status = (userOpen() ? [[" USER: SAVE CODES AND PASSKEYS. THE RUN WAITS.", "t"]]
    : ledgerOpen() ? [[" LEDGER: EVERY SEALED DAY AND RUN. THE RUN WAITS.", "t"]]
    : P.done ? [[" RUN OVER. ", "b"], [P.seal || "", "t"]]
    : [[" TARGETS LEFT " + P.left, "e"], P.shut ? ["   CLEAR THE EXIT ROOM", "t"] : ["   THE EXIT IS OPEN", "g"],
       [touch ? "   STICK + DRAG" : locked() || !lockWorks ? "   WASD + MOUSE" : "   CLICK THE VIEW", "d"]]);
  const used = status.reduce((n, [t]) => n + t.length, 0);
  const again = P.done && !over ? [["[R]UN IT BACK", "btn", "r"], ["  ", ""]] : [];
  const buttons = over ? [["[ESC] CLOSE", "btn", "esc"]] : [["[L]EDGER", "btn", "l"], ["  ", ""], ["[U]SER", "btn", "u"]];
  const right = again.reduce((n, [t]) => n + t.length, 0) + buttons.reduce((n, [t]) => n + t.length, 0) + 1;
  status.push([" ".repeat(Math.max(1, FW - 2 - used - right)), ""], ...again, ...buttons, [" ", ""]);
  const L = [top, "|" + head + "|", mid];
  for (let i = 0; i < 17; i++) L.push("|" + " ".repeat(VWc) + "|" + seg(rows[i] || [[""]], PW) + "|");
  // 4Dungeon's bottom (daily-dungeon screen.js): three log lines, then a row of buttons. The log is the kill feed, newest last.
  const log = feed.slice(-3);
  while (log.length < 3) log.unshift(["", ""]);
  L.push(top, ...log.map(([t, c]) => "|" + seg([[" " + t, c]], FW - 2) + "|"), dash, "|" + seg(status, FW - 2) + "|", top);
  setFrame(L.join("\n"));
}

// 4Dungeon's minimap (engine/floor.js), 29 x 5, centred on the room you're in: the rooms you've walked
// through, the ways out of them, and an arrow for the way you face. Drawn by floor.js, 4Dungeon's own minimap code, from
// the floor as it is (every door a gap, a locked one #, one into another wing wall), then a + put on every room corner. floor.js draws extra hallways out of room 0 (an irl-dungeon
// rule), so it is handed the floor with every room number moved up by one.
function minimap() {
  const f = cor.floor, up = (j) => j + 1, at = P.seen[P.seen.length - 1];
  const view = {
    // a door into a room that isn't built (another wing's) is left out, so floor.js draws it as wall, as the 3D view has it
    rooms: [undefined, ...f.rooms.map((r) => r && { ...r, doors: Object.fromEntries(Object.entries(r.doors).filter(([, j]) => !f.rooms[j] || cor.near[j]).map(([d, j]) => [d, up(j)])) })],
    start: up(f.start), sealed: Object.fromEntries(Object.keys(f.sealed || {}).map((j) => [up(+j), true])),
  };
  const visited = []; for (const i of P.seen) visited[up(i)] = true;
  const { dx, dy } = eye();
  const facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "E" : "W") : dy > 0 ? "S" : "N";
  const rows = FLOOR.minimap(view, { at: up(at), visited, facing }).map((r) => r.split(""));
  // every corner of a room you've been in is a +, even next to a door (floor.js draws those as - or |)
  const here = f.rooms[at];
  for (const i of P.seen) {
    const row = 2 + (f.rooms[i].r - here.r) * 2, col = 13 + (f.rooms[i].c - here.c) * 4;
    for (const y of [row - 1, row + 1]) for (const x of [col - 1, col + 3]) if (rows[y] && x >= 0 && x < rows[y].length) rows[y][x] = "+";
  }
  return rows.map((r) => r.join(""));
}

// ---- banner -------------------------------------------------------------------------------------------------
let bannerT = 0;
function showBanner(lines, secs) {
  const inner = Math.max(...lines.map(([t]) => t.length)) + 4;
  const box = `<span class="t">+${"-".repeat(inner)}+</span>`, bar = `<span class="t">|</span>`;
  const row = ([t, c]) => {
    const l = Math.floor((inner - t.length) / 2), body = c ? `<span class="${c}">${esc(t)}</span>` : esc(t);
    return bar + " ".repeat(l) + body + " ".repeat(inner - t.length - l) + bar;
  };
  $("bannerText").innerHTML = [box, ...lines.map(row), box].join("\n");
  $("banner").hidden = false; bannerT = secs;
}

// ---- play ---------------------------------------------------------------------------------------------------
// A shot, at this tick (corridor.js fire: it decides the hit and logs [tick, 2, row, hit]).
// Gibs: one chunk of data for each point of damage a hit does, 2 or 3 cells wide, flying off where a shot hits (at the crosshair), falling and gone in under a second.
// Drawing only: nothing in the engine.
const GIB_GLYPHS = "#%&@$8", GIB_LIFE = 0.65;
function gib(n) {
  if (reduced) return;
  const x = C.AIM + P.jit, y = P.aimY;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 2 * Math.PI, sp = 20 + Math.random() * 30;
    P.gibs.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.45 - 6, t: GIB_LIFE * (0.6 + Math.random() * 0.4), c: GIB_GLYPHS[Math.floor(Math.random() * GIB_GLYPHS.length)], w: 2 + (Math.random() < 0.4 ? 1 : 0), h: Math.random() < 0.3 ? 2 : 1 });
  }
}

function shoot() {
  if (P.done || dying() || P.reload > 0) return;
  P.flash = 0.08;
  const was = P.streak;
  const hpBefore = P.enemies.reduce((n, e) => n + e.hp, 0);
  const hit = C.fire(P, P.aimY);
  gib(hpBefore - P.enemies.reduce((n, e) => n + e.hp, 0));   // one chunk per point of damage: legs 1, chest 2, head 4, crown 5, a drone's O 6
  if (hit === "headkill") { P.left--; say("HEADSHOT!! YOU fragged ENEMY", "b"); }
  else if (hit === "kill") { P.left--; say("YOU fragged ENEMY", "b"); }
  else if (hit === "head") say("YOU nailed ENEMY in the head", "t");
  else if (hit === "body") say("YOU tagged ENEMY", "t");
  else if (hit === "leg") say("YOU tagged ENEMY in the leg", "t");
  else if (hit === "miss") say("YOU whiffed", "d");
  if (P.reload > 0) say("RELOADING", "g");
  if ((hit === false || hit === "miss") && was < C.TILT_HALF && P.streak >= C.TILT_HALF) say("you're on TILT", "g");
}

function finish() {
  P.done = C.label(P);
  if (document.pointerLockElement) document.exitPointerLock();
  endBanner(P.done);
  if (P.practice) P.seal = "PRACTICE MODE. NOT SEALED."; else seal();
}

// After the run is over: play today's corridor again, as practice. It's never sent, so today's sealed run stays.
function runItBack() {
  const old = snapshot();
  build(); P.practice = true; startWipe(old);
  $("banner").hidden = true; bannerT = 0;
  say("PRACTICE MODE: this one doesn't count. Your sealed run stays.", "t");
}

function endBanner(kind) {
  const lines = {
    CLUTCH: [["", ""], [" CLUTCH ", "big g"], ["", ""], [`OUT ON ${P.hp} HP`, "b"], [`${P.hits} HITS / ${P.shots} SHOTS`, "t"]],
    TILT: [["", ""], [" TILT ", "big g"], ["", ""], ["YOU GOT OUT BY SPRAYING", "b"], ["AND PRAYING.", "b"]],
    FEED: [["", ""], [" FEED ", "big e"], ["", ""], [P.hp > 0 ? "TIME'S UP. YOU NEVER GOT OUT." : "YOU GOT FRAGGED.", "b"], P.left === null ? ["", ""] : [`${P.left} ${P.left === 1 ? "TARGET" : "TARGETS"} STILL STANDING`, "t"]],
  }[kind];
  lines.push(["", ""]);
  showBanner(lines, Infinity);
}

// Send the finished run's shots to be sealed on the ledger (one a day). The server plays the run again from them and
// seals what it got; if that isn't what this page got, the page shows the server's.
function seal() {
  P.seal = "SEALING...";
  const run = { day, inputs: P.log.map((s) => s.slice(0, 3)) };
  fetch("/api/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(run) })
    .then(async (r) => [r.ok, await r.json()])
    .then(([ok, b]) => {
      if (!ok) { P.seal = "NOT SEALED."; say(b.error || "SERVER SAYS NO.", "e"); return; }
      P.seal = `SEALED: LEDGER ENTRY #${b.run.entry}`;
      if (b.run.hits !== P.hits || b.run.hp !== P.hp || b.run.shots !== P.shots || b.run.label !== P.done) {
        Object.assign(P, { hp: b.run.hp, shots: b.run.shots, hits: b.run.hits, done: b.run.label });
        say(`SERVER REPLAY: ${b.run.label}, ${b.run.hits} HITS / ${b.run.shots} SHOTS.`, "g"); endBanner(b.run.label);
      }
      say(`Sealed as ledger entry #${b.run.entry} (${b.run.hash.slice(0, 8)}).`, "b");
    })
    .catch(() => { P.seal = "NOT SEALED."; say("CONNECTION LOST. This run wasn't sealed.", "e"); });
}

// Today's run is already sealed: show it, and no new run until tomorrow's corridor.
function showSealed(run) {
  build();
  Object.assign(P, { hp: run.hp, shots: run.shots, hits: run.hits, kills: null, left: null, over: true, done: run.label,
                     seal: `TODAY'S RUN IS SEALED: ENTRY #${run.entry}` });
  enemies.forEach((e) => e.state = "dead");
  say(`Sealed as ledger entry #${run.entry} (${run.hash.slice(0, 8)}). Next corridor at midnight UTC.`, "b");
  endBanner(run.label);
}

// One frame: the page's own easing and timers, then as many of the engine's fixed ticks as the time that passed holds.
function step(dt) {
  P.sway -= P.sway * Math.min(1, dt * 8); P.flash = Math.max(0, P.flash - dt);
  P.gibs = P.gibs.filter((g) => (g.t -= dt) > 0);
  for (const g of P.gibs) { g.x += g.vx * dt; g.y += g.vy * dt; g.vy += 40 * dt; }
  P.hurt = Math.max(0, P.hurt - dt);
  $("view").classList.toggle("hurt", P.hurt > 0);
  if (bannerT !== Infinity) { bannerT -= dt; if (bannerT <= 0) $("banner").hidden = true; }
  if (wipe) {   // the fight waits while the screen melts
    wipe.t += dt; lag = 0;
    if (wipe.done) { const then = wipe.then; wipe = null; if (then) then(); }
    if (!P.done && !dying()) return;
  }
  if (P.done) return;
  if (dying()) {
    P.deathT += dt;
    const tgt = P.killer ? Math.atan2(P.killer.y - P.y, P.killer.x - P.x) : P.viewA;   // turn to face them, 75 degrees a second
    let dA = tgt - P.viewA; dA -= Math.round(dA / (2 * Math.PI)) * 2 * Math.PI;
    P.viewA += Math.sign(dA) * Math.min(Math.abs(dA), 75 * Math.PI / 180 * dt);
    if (P.deathT >= MELT_AT && !wipe && !P.melting) { P.melting = true; startWipe(null, card([["F R A G G E D", "e"]]), finish, MELT_SPEED / 2); }
    return;
  }
  for (lag += dt; lag >= 1 / C.FPS - 0.004 && !P.done; lag -= 1 / C.FPS) {
    for (const ev of C.tick(P)) if (ev === "hurt") {
      P.hurt = 0.25; say("ENEMY tagged YOU", "e");
      if (!reduced) { $("game").classList.remove("shake"); void $("game").offsetWidth; $("game").classList.add("shake"); }
    } else if (ev === "open") say("THE EXIT IS OPEN", "g");
    for (const e of enemies) if ((e.state === "dying" || e.state === "dead") && e.diedAt === undefined) e.diedAt = P.tick;
    const r = C.roomOf(cor, P.x, P.y);
    if (r >= 0 && r !== P.seen[P.seen.length - 1]) { P.seen = P.seen.filter((i) => i !== r).concat(r); }
    // what the ghosts did on this tick of their runs
    for (const m of squad) {
      const g = m.track[P.tick - 1], was = m.track[P.tick - 2];
      if (!g || !was) continue;
      if (g.k > was.k) say(`${m.n} fragged ENEMY`, "h");
      if (g.over && !was.over) say(g.out ? `${m.n} got out` : `${m.n} was fragged`, g.out ? "h" : "e");
    }
    if (P.over) {
      if (P.hp <= 0 && !reduced) {   // dying: fall, then melt (above), then finish
        P.deathT = 0; P.viewA = P.a * 2 * Math.PI / C.TURN;
        P.killer = enemies.filter((e) => e.state === "out").sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0];
        break;
      }
      if (P.escaped) { startWipe(null, card([["Y O U   G O T   O U T", "b"]]), finish); break; }
      finish();
    }
  }
  P.jit = C.jit(P);
}

// the game runs and draws at 15 frames a second, like an old PC, whatever the screen's refresh rate
let last = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  if (last && ts - last < 1000 / C.FPS - 2) return;
  const dt = Math.min(0.1, last ? (ts - last) / 1000 : 0); last = ts;
  if (!userOpen() && !ledgerOpen()) step(dt);
  render(); frame();
}

// ---- input --------------------------------------------------------------------------------------------------
// Walking is the keys held (W A S D, or the touch stick), sent to the engine as a set of bits when they change
// (corridor.js press). Turning is the mouse moving left and right (or a drag on the right half of the view on a phone),
// sent as whole TURN units (corridor.js turn). Moving it up and down moves the crosshair up and down (it's not sent: a
// shot carries its row). On a computer, a click on the view captures the mouse (pointer lock; Esc lets it go), and
// from then on a click shoots. Where pointer lock isn't allowed, the mouse still turns you as it crosses the view.
const view = $("view");
const KEYS = { w: 1, s: 2, a: 4, d: 8 };
const TURN_PX = 1, TURN_TOUCH = 4, AIMY_PX = 0.03, AIMY_TOUCH = 0.1;   // turn units, and crosshair rows, per pixel
let held = 0, stick = 0, turnLeft = 0, touch = false, lockWorks = true;
const locked = () => document.pointerLockElement === view;
const canPlay = () => P && !P.done && !userOpen() && !ledgerOpen();
const sendKeys = () => { if (P) C.press(P, canPlay() ? held | stick : 0); };
function look(dx, dy, perPx, perRow) {
  if (!canPlay()) return;
  turnLeft += dx * perPx;
  const d = Math.trunc(turnLeft);
  if (d) { turnLeft -= d; C.turn(P, d); P.sway = Math.max(-GUN_SWING, Math.min(GUN_SWING, P.sway - d * 0.04)); }
  P.aimY = Math.max(1, Math.min(C.AIM_MAX_Y, P.aimY + dy * perRow));   // the crosshair stays above the gun
}

// The first move after the mouse is taken or let go can carry the whole jump from where the pointer was (Chrome does
// this), so it's skipped, as is any single move of more than 400 pixels.
let skipMove = false;
addEventListener("pointermove", (ev) => {
  if (ev.pointerType === "touch" || !P) return;
  if (skipMove || Math.abs(ev.movementX) > 400 || Math.abs(ev.movementY) > 400) { skipMove = false; return; }
  if (locked() || (!lockWorks && view.contains(ev.target))) look(ev.movementX, ev.movementY, TURN_PX, AIMY_PX);
});
document.addEventListener("pointerlockchange", () => { skipMove = true; });
document.addEventListener("pointerlockerror", () => { lockWorks = false; });
view.addEventListener("pointerdown", (ev) => {
  if (!P) return;
  ev.preventDefault();
  // preventDefault stops the click from focusing the page, so W A S D would go to whatever had focus (the page around
  // it, when the game is in a frame): focus the view by hand
  window.focus(); view.focus({ preventScroll: true });
  if (ev.pointerType === "touch") return touchDown(ev);
  touch = false;
  if (!locked() && lockWorks && canPlay()) {
    const p = view.requestPointerLock();
    if (p && p.catch) p.catch(() => { lockWorks = false; });
    return;
  }
  shoot();
});

// Phones: a thumb down on the left half of the view is a stick (drag it to walk), on the right half it turns and aims
// as it drags, and a quick tap there shoots.
const pads = new Map();
function touchDown(ev) {
  touch = true;
  const r = view.getBoundingClientRect(), left = ev.clientX - r.left < r.width / 2;
  pads.set(ev.pointerId, { left, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, t: performance.now(), moved: 0 });
  try { view.setPointerCapture(ev.pointerId); } catch {}   // keeps the drag ours if the thumb slides off the view
}
view.addEventListener("pointermove", (ev) => {
  const p = pads.get(ev.pointerId);
  if (!p) return;
  const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
  p.x = ev.clientX; p.y = ev.clientY; p.moved += Math.abs(dx) + Math.abs(dy);
  if (p.left) {
    const sx = p.x - p.x0, sy = p.y - p.y0, dead = 12;
    stick = (sy < -dead ? 1 : 0) | (sy > dead ? 2 : 0) | (sx < -dead ? 4 : 0) | (sx > dead ? 8 : 0);
    sendKeys();
  } else look(dx, dy, TURN_TOUCH, AIMY_TOUCH);
});
function touchUp(ev) {
  const p = pads.get(ev.pointerId);
  if (!p) return;
  pads.delete(ev.pointerId);
  if (p.left) { stick = 0; sendKeys(); }
  else if (p.moved < 10 && performance.now() - p.t < 300) shoot();
}
view.addEventListener("pointerup", touchUp);
view.addEventListener("pointercancel", touchUp);

addEventListener("keyup", (ev) => { const b = KEYS[ev.key.toLowerCase()]; if (b) { held &= ~b; sendKeys(); } });
addEventListener("blur", () => { held = 0; stick = 0; sendKeys(); });
// a click on a message box closes it (and isn't a shot)
$("banner").addEventListener("pointerdown", (ev) => { ev.preventDefault(); $("banner").hidden = true; bannerT = 0; });

$("version").textContent = "v" + VERSION;
setupAccount((name) => { myName = name; });
setupLedger();
// pointerdown, not click: the frame is redrawn 15 times a second, so the span pressed may be gone by the release
$("frame").addEventListener("pointerdown", (ev) => { const s = ev.target.closest("[data-k]"); if (!s || !P) return; if (s.dataset.k === "u") openPlayer(); else if (s.dataset.k === "l") openLedger(); else if (s.dataset.k === "esc") { closePlayer(); closeLedger(); } else if (s.dataset.k === "r" && P.done) runItBack(); });
addEventListener("keydown", (ev) => {
  if (userOpen() || ledgerOpen() || !P || ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const b = KEYS[ev.key.toLowerCase()];
  if (b) { ev.preventDefault(); held |= b; sendKeys(); return; }
  // a panel covers the view: let the mouse go and stop walking
  const panel = () => { if (locked()) document.exitPointerLock(); held = 0; sendKeys(); };
  if (ev.key === "l" || ev.key === "L") { ev.preventDefault(); openLedger(); panel(); }
  else if (ev.key === "u" || ev.key === "U") { ev.preventDefault(); openPlayer(); panel(); }
  else if (ev.key === "r" || ev.key === "R") { ev.preventDefault(); if (P.done) runItBack(); else if (C.reload(P)) say("RELOADING", "g"); }
});

// ---- today's corridor from the server -----------------------------------------------------------------------
frame("LOADING TODAY'S CORRIDOR...");
fetch("/api/today").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((t) => {
  day = t.day; SEED = t.seed; WING = t.wing; myName = t.name; GHOSTS = t.ghosts || [];
  if (t.run) showSealed(t.run);
  else { build(); const lv = C.level(day); startWipe(card([["T I L T . E X E", "b"], ["", ""], [`${day}  4DUNGEON ${lv.name} WING ${WING}`, "t"]])); }
  requestAnimationFrame(loop);
}).catch(() => frame("CAN'T REACH THE SERVER. RELOAD TO TRY AGAIN."));
