// The page: draws the frame and the view, runs the fight, and names the run. The rules are in engine/corridor.js.
import * as C from "./engine/corridor.js";
import FLOOR from "./engine/floor.js";
import { VERSION } from "./engine/version.js";
import { setupAccount, openPlayer, closePlayer, isOpen as userOpen } from "./account.js";

const W = 94, H = 34;                // the view window at half-size characters: 47 x 17 cells of the frame, doubled
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

let day = "", SEED = 0, myName = null;
let cor, open, enemies, squad, feed, P;
const isOpen = (x, y) => x >= 0 && y >= 0 && x < cor.w && y < cor.h && open[y][x];

// ---- a run --------------------------------------------------------------------------------------------------
function build() {
  cor = C.corridor(SEED);
  open = cor.open;
  enemies = cor.enemies.map((e) => ({ ...e, hx: e.x, hy: e.y, state: "hidden", out: 0, dieT: 0 }));
  squad = cor.squad.map((m) => ({ ...m, k: 0, dead: false }));
  // What the teammates did, replayed as kill-feed lines: two of them trade, then all four go down.
  const s = squad, t0 = cor.t0;
  P = {
    s: 0, t: 0, hp: C.HP, shots: 0, hits: 0, streak: 0, aim: W / 2, gx: W / 2, aimY: H / 2 - 1, jit: 0, flash: 0, hurt: 0,
    left: C.ENEMIES, phase: "push", done: null, log: [], turns: C.turns(cor.path), tt: 0,
    script: [
      [t0, () => { s[0].k++; P.left--; say(`${s[0].n} got a kill`, "h"); }],
      [t0 + 1.2, () => { s[3].dead = true; say(`BOT_FEEDER died`, "e"); }],
      [t0 + 2.0, () => { s[1].dead = true; say(`${s[1].n} died`, "e"); }],
      [t0 + 2.7, () => { s[2].k++; P.left--; say(`${s[2].n} got a kill`, "h"); }],
      [t0 + 3.3, () => { s[2].dead = true; say(`${s[2].n} died`, "e"); }],
      [t0 + 3.9, () => { s[0].dead = true; say(`${s[0].n} died`, "e"); clutchMoment(); }],
    ],
  };
  feed = [];
}
function say(t, c) { feed.push([t.slice(0, 77), c]); if (feed.length > 3) feed.shift(); }

function clutchMoment() {
  P.phase = "clutch";
  showBanner([["", ""], ["   1 v " + P.left + "   ", "big g"], ["", ""], ["  LAST ONE ALIVE  ", "b"]], 1.6);
}

// ---- drawing the view ---------------------------------------------------------------------------------------
const RAMP = "@#%*+=-:";
const COL = (15 * Math.PI / 180) / 21;   // how much further round each column of the view looks: 15 degrees is 21 columns
const TURN_TIME = 0.8;                    // a turn on the spot: TURN_STEPS jumps of 15 degrees, two frames each at 15 fps
const turning = () => P.turns.length > 0 && P.s >= P.turns[0] * C.S;
const eye = () => C.along(cor.path, P.s, turning() ? P.tt / TURN_TIME : 0);
const ch = Array.from({ length: H }, () => new Array(W).fill(" "));
const cl = Array.from({ length: H }, () => new Array(W).fill(""));
const zbuf = new Float64Array(W);
const put = (x, y, c, k) => { if (x >= 0 && x < W && y >= 0 && y < H) { ch[y][x] = c; cl[y][x] = k; } };

function render() {
  for (let y = 0; y < H; y++) { ch[y].fill(" "); cl[y].fill(""); }
  // the camera: on the rails, facing along them. Each column looks COL further round than the one to its left and the
  // walls are as tall as they are near, not as the ray is deep, so a turn on the spot slides the picture sideways and
  // changes nothing else: a 15 degree jump moves it exactly 21 columns.
  const { x: px, y: py, dx: fx, dy: fy } = eye(), base = Math.atan2(fy, fx), rail = C.along(cor.path, P.s);
  let prev = "";
  for (let x = 0; x < W; x++) {
    const th = base + (x + 0.5 - W / 2) * COL, rdx = Math.cos(th), rdy = Math.sin(th);
    let mx = Math.floor(px), my = Math.floor(py);
    const ddx = Math.abs(1 / (rdx || 1e-9)), ddy = Math.abs(1 / (rdy || 1e-9));
    const sx = rdx < 0 ? -1 : 1, sy = rdy < 0 ? -1 : 1;
    let sdx = rdx < 0 ? (px - mx) * ddx : (mx + 1 - px) * ddx, sdy = rdy < 0 ? (py - my) * ddy : (my + 1 - py) * ddy, side = 0;
    for (let i = 0; i < 80; i++) {
      if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
      if (!isOpen(mx, my)) break;
    }
    const d = side === 0 ? sdx - ddx : sdy - ddy;
    zbuf[x] = d;
    // a panel is one face of one wall block: drawn flat, as tall as its middle is near, one character all over, with a
    // line down its left edge. Only where you stand changes it, never which way you face.
    const fcx = side === 0 ? mx + (sx < 0 ? 1 : 0) : mx + 0.5, fcy = side === 0 ? my + 0.5 : my + (sy < 0 ? 1 : 0);
    const pd = Math.max(0.3, Math.hypot(fcx - px, fcy - py)), id = mx + "," + my + "," + side;
    const wh = H / pd, top = Math.round(H / 2 - wh / 2), bot = Math.round(H / 2 + wh / 2);
    const r = Math.min(RAMP.length - 1, Math.floor(pd / 1.6) + (side === 1 ? 1 : 0));
    const seam = x > 0 && id !== prev && pd < 9; prev = id;
    for (let y = Math.max(0, top); y < Math.min(H, bot); y++) {
      put(x, y, seam ? "|" : (y === top || y === bot - 1) && pd < 12 ? "_" : RAMP[r], pd > 14 ? "d" : pd > 7 ? "t" : "");
    }
    // the floor grid: only the lines running the way the rails go, so nothing scrolls toward you
    for (let y = Math.max(bot, H / 2 + 1); y < H; y++) {
      const rd = H / (2 * (y + 0.5 - H / 2)); if (rd >= d) continue;
      const wv = Math.abs(rail.dx) < Math.abs(rail.dy) ? px + rd * rdx : py + rd * rdy, fr = wv - Math.floor(wv);
      if (fr < 0.05) put(x, y, ".", rd > 6 ? "d" : "t");
    }
  }
  // enemies, far to near
  const depth = (e) => Math.hypot(e.x - px, e.y - py);
  const vis = enemies.filter((e) => e.state !== "hidden" || e.s - P.s < 9).sort((a, b) => depth(b) - depth(a));
  for (const e of vis) {
    const ry = depth(e); if (ry < 0.3) continue;
    let da = Math.atan2(e.y - py, e.x - px) - base; da -= Math.round(da / (2 * Math.PI)) * 2 * Math.PI;
    if (Math.abs(da) > Math.PI / 2) continue;
    const sxc = W / 2 + da / COL;
    let sh = H * 0.8 / ry; const sw = 0.5 / ry / COL;
    if (e.state === "dying") sh *= Math.max(0, 1 - e.dieT / 0.5);
    if (e.state === "dead" || sh < 1) continue;
    const bot = Math.round(H / 2 + H / (2 * ry)), top = Math.round(bot - sh);
    const l = Math.round(sxc - sw / 2), rr = Math.round(sxc + sw / 2);
    e.sx = [l, rr]; e.sy = [top, bot]; e.sd = ry;
    for (let x = Math.max(0, l); x < Math.min(W, rr); x++) {
      if (zbuf[x] < ry) continue;
      const u = (x - l) / Math.max(1, rr - l);
      for (let y = Math.max(0, top); y < Math.min(H, bot); y++) {
        const f = (y - top) / Math.max(1, sh);
        let c = "";
        if (e.state === "dying") c = "%";
        else if (f < 0.22) c = Math.abs(u - 0.5) < 0.2 ? "@" : "";
        else if (f < 0.6) c = Math.abs(u - 0.5) < 0.36 ? "#" : (f > 0.3 && f < 0.42 && u > 0.5) ? "=" : "";
        else c = (Math.abs(u - 0.3) < 0.11 || Math.abs(u - 0.7) < 0.11) ? "|" : "";
        if (c) put(x, y, c, "e");
      }
    }
    if (e.state === "out" && e.fire < 0.7 && Math.floor(P.t * 8) % 2 === 0) put(Math.round(sxc), top - 1, "!", "g");
  }
  // crosshair
  const ax = Math.round(P.aim + P.jit), ay = Math.round(P.aimY);
  if (!P.done) {
    put(ax - 2, ay, "-", "b"); put(ax - 1, ay, "-", "b"); put(ax + 1, ay, "-", "b"); put(ax + 2, ay, "-", "b");
    put(ax, ay, P.flash > 0 ? "*" : "+", P.flash > 0 ? "g" : "b"); put(ax, ay - 1, "|", "b"); put(ax, ay + 1, "|", "b");
  }
  // the gun: one rigid piece at the bottom middle, moving after the crosshair along a small arc (one row lower once it is
  // more than halfway out to the side) and kicking down a row when it fires. P.gx eases toward the pointer in step().
  const lean = Math.max(-GUN_SWING, Math.min(GUN_SWING, (P.gx - W / 2) * 0.2));
  const gx = Math.round(W / 2 - GUN[0].length / 2 + lean), gy = H - GUN.length + (Math.abs(lean) > GUN_SWING / 2 ? 1 : 0) + (P.flash > 0 ? 1 : 0);
  GUN.forEach((s, i) => { for (let k = 0; k < s.length; k++) if (s[k] !== " ") put(gx + k, gy + i, s[k], P.flash > 0 && i < 4 ? "g" : "t"); });

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
  const head = seg([[" CLUTCH FEED TILT", "b"], ["                 ", ""], [`DAILY CORRIDOR ${day}`, "t"],
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
  const tilt = Math.min(5, P.streak);
  const time = `${Math.floor(P.t / 60)}:${(P.t % 60).toFixed(1).padStart(4, "0")}`;
  const acc = P.shots ? Math.round(100 * P.hits / P.shots) : 0;
  const rows = [
    [[" SQUAD", ""], ["            HP    K", "t"]],
    [[rule, "d"]],
    [[" " + pad(myName || "YOU", 15).slice(0, 15), "b"], [hpBar, P.hp > 1 ? "b" : "e"], ["  ", ""], [String(P.hits), "b"]],
    ...squad.map((m) => [[" " + pad(m.n, 10), m.dead ? "d" : m.tag === "bot" ? "t" : "h"], [m.tag === "bot" ? " bot  " : " ghost", "d"],
                         [" ", ""], [m.dead ? "DEAD " : "[###]", m.dead ? "e" : "t"], ["  " + m.k, m.dead ? "d" : "t"]]),
    [[rule, "d"]],
    [[""]],
    ...minimap().map((line) => line.split("@").flatMap((part, i) => i ? [["@", "b"], [part, "t"]] : [[" " + part, "t"]])),
    [[rule, "d"]],
    [[` SHOTS ${String(P.shots).padStart(2, "0")}  HITS ${String(P.hits).padStart(2, "0")}  ACC ${String(acc).padStart(3)}%`, "t"]],
    [[" TILT ", "t"], ["[" + "#".repeat(tilt) + ".".repeat(5 - tilt) + "]", tilt >= 3 ? "e" : tilt ? "g" : "d"], ["     " + time, "t"]],
  ];
  const status = (userOpen() ? [[" USER: SAVE CODES AND PASSKEYS. THE RUN WAITS.", "t"]]
    : P.done ? [[" RUN OVER. ", "b"], [P.seal || "", "t"]]
    : P.phase === "push" ? [[" YOUR SQUAD PUSHES IN", "t"], ["   ENEMIES LEFT " + P.left, "e"], ["   TAP TO SHOOT", "d"]]
    : [[" 1v" + P.left + " ", "g"], ["LAST ALIVE", "b"], ["   ENEMIES LEFT " + P.left, "e"], ["   TAP TO SHOOT", "d"]]);
  const used = status.reduce((n, [t]) => n + t.length, 0);
  status.push([" ".repeat(Math.max(1, FW - 2 - used - 12)), ""], [userOpen() ? "[ESC] CLOSE" : "[U]SER", "btn", userOpen() ? "esc" : "u"], [" ", ""]);
  const L = [top, "|" + head + "|", mid];
  for (let i = 0; i < 17; i++) L.push("|" + " ".repeat(VWc) + "|" + seg(rows[i] || [[""]], PW) + "|");
  // 4Dungeon's bottom (daily-dungeon screen.js): three log lines, then a row of buttons. The log is the kill feed, newest last.
  const log = feed.slice(-3);
  while (log.length < 3) log.unshift(["", ""]);
  L.push(top, ...log.map(([t, c]) => "|" + seg([[" " + t, c]], FW - 2) + "|"), dash, "|" + seg(status, FW - 2) + "|", top);
  setFrame(L.join("\n"));
}

// 4Dungeon's minimap (engine/floor.js), 29 x 5, centred on the room you're in: the rooms of the rails you've walked
// through, the ways out of them, and an arrow for the way you face. floor.js draws extra hallways out of room 0 (an
// irl-dungeon rule), so it is handed the floor with every room number moved up by one.
function minimap() {
  const k = Math.min(cor.route.length - 1, Math.round(P.s / C.S)), f = cor.floor, up = (j) => j + 1;
  const view = {
    rooms: [undefined, ...f.rooms.map((r) => r && { ...r, doors: Object.fromEntries(Object.entries(r.doors).map(([d, j]) => [d, up(j)])) })],
    start: up(f.start), sealed: Object.fromEntries(Object.keys(f.sealed || {}).map((j) => [up(+j), true])),
  };
  const visited = []; for (const i of cor.route.slice(0, k + 1)) visited[up(i)] = true;
  const { dx, dy } = eye();
  const facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "E" : "W") : dy > 0 ? "S" : "N";
  return FLOOR.minimap(view, { at: up(cor.route[k]), visited, facing });
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
function shoot(col, row) {
  if (P.done) return;
  P.flash = 0.08;
  P.shots++;   // every shot counts, with or without anything to shoot at: firing at nothing is a miss
  const c = Math.round(col + P.jit), r = Math.round(row);
  const hit = enemies.filter((e) => e.state === "out" || e.state === "stepping")
    .filter((e) => e.sx && c >= e.sx[0] - 1 && c <= e.sx[1] && r >= e.sy[0] - 1 && r <= e.sy[1] && zbuf[Math.max(0, Math.min(W - 1, c))] > e.sd)
    .sort((a, b) => a.sd - b.sd)[0];
  if (hit) {
    hit.state = "dying"; hit.dieT = 0; P.hits++; P.streak = 0; P.left--;
    say("YOU got a kill", "b");
    P.log.push([+P.t.toFixed(2), c, r, 1]);
  } else {
    P.streak++;
    P.log.push([+P.t.toFixed(2), c, r, 0]);
    if (P.streak === 3) say("you're tilting...", "g");
  }
}

function finish() {
  P.done = C.label(P);
  endBanner(P.done);
  seal();
}

function endBanner(kind) {
  const lines = {
    CLUTCH: [["", ""], [" CLUTCH ", "big g"], ["", ""], [`1v3 ON ${P.hp} HP`, "b"], [`${P.hits} hits from ${P.shots} shots`, "t"]],
    TILT: [["", ""], [" TILT ", "big g"], ["", ""], ["Won it, but the crosshair", "b"], ["was shaking the whole time.", "b"]],
    FEED: [["", ""], [" FEED ", "big e"], ["", ""], ["Gave away free kills.", "b"], [`${P.left} ${P.left === 1 ? "enemy" : "enemies"} still up`, "t"]],
  }[kind];
  lines.push(["", ""]);
  showBanner(lines, Infinity);
}

// Send the finished run to be sealed on the ledger (one a day; the server checks it and names it again).
function seal() {
  P.seal = "SEALING...";
  const run = { day, hp: P.hp, shots: P.shots, hits: P.hits, log: P.log };
  fetch("/api/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(run) })
    .then(async (r) => [r.ok, await r.json()])
    .then(([ok, b]) => {
      if (!ok) { P.seal = "NOT SEALED."; say(b.error || "The server said no.", "e"); return; }
      P.seal = `SEALED: LEDGER ENTRY #${b.run.entry}`;
      say(`Sealed as ledger entry #${b.run.entry} (${b.run.hash.slice(0, 8)}).`, "b");
    })
    .catch(() => { P.seal = "NOT SEALED."; say("Couldn't reach the server, so this run wasn't sealed.", "e"); });
}

// Today's run is already sealed: show it, and no new run until tomorrow's corridor.
function showSealed(run) {
  build();
  Object.assign(P, { hp: run.hp, shots: run.shots, hits: run.hits, left: enemies.length - run.hits, script: [], phase: "clutch", done: run.label,
                     seal: `TODAY'S RUN IS SEALED: ENTRY #${run.entry}` });
  enemies.forEach((e) => e.state = "dead"); squad.forEach((m) => m.dead = true);
  say(`Sealed as ledger entry #${run.entry} (${run.hash.slice(0, 8)}). Next corridor at midnight UTC.`, "b");
  endBanner(run.label);
}

function step(dt) {
  P.t += dt; P.gx += (P.aim - P.gx) * Math.min(1, dt * 14); P.flash = Math.max(0, P.flash - dt); P.hurt = Math.max(0, P.hurt - dt);
  $("view").classList.toggle("hurt", P.hurt > 0);
  if (bannerT !== Infinity) { bannerT -= dt; if (bannerT <= 0) $("banner").hidden = true; }
  while (P.script.length && P.script[0][0] <= P.t) P.script.shift()[1]();
  P.jit = P.streak >= 2 ? (Math.sin(P.t * 23) + Math.sin(P.t * 37)) * (Math.min(5, P.streak) - 1) * 0.7 : 0;
  if (P.done) return;

  const active = enemies.filter((e) => e.state === "stepping" || e.state === "out");
  const next = enemies.find((e) => e.state === "hidden" && e.s - P.s < 4.2);
  if (next && P.phase !== "push") enemies.filter((e) => e.state === "hidden" && Math.abs(e.s - next.s) < 2).forEach((e) => e.state = "stepping");
  const stopAt = Math.min(...enemies.filter((e) => e.state === "hidden").map((e) => e.s - 4.0), cor.end);
  if (!active.length && !next) {
    // walk to the centre of the next room where the rails turn, turn there on the spot, then walk on
    const j = P.turns[0];
    if (turning()) { P.tt += dt; if (P.tt >= TURN_TIME) { P.turns.shift(); P.tt = 0; P.s = j * C.S + 1e-6; } }
    else P.s = Math.min(stopAt, j === undefined ? Infinity : j * C.S, P.s + 1.25 * dt);
  }

  for (const e of enemies) {
    if (e.state === "stepping") { e.out = Math.min(1, e.out + dt / 0.45); e.x = e.hx + (e.tx - e.hx) * e.out; e.y = e.hy + (e.ty - e.hy) * e.out; if (e.out >= 1) e.state = "out"; }
    else if (e.state === "out") {
      e.fire -= dt;
      if (e.fire <= 0) {
        e.fire = 1.7; P.hp--; P.hurt = 0.25; say("ENEMY hit YOU", "e");
        if (!reduced) { $("game").classList.remove("shake"); void $("game").offsetWidth; $("game").classList.add("shake"); }
        if (P.hp <= 0) { P.hp = 0; finish(); return; }
      }
    } else if (e.state === "dying") { e.dieT += dt; if (e.dieT > 0.5) e.state = "dead"; }
  }
  if (enemies.every((e) => e.state === "dead") && P.s >= cor.end - 0.01) finish();
}

// the game runs and draws at 15 frames a second, like an old PC, whatever the screen's refresh rate
const FPS = 15;
let last = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  if (last && ts - last < 1000 / FPS - 2) return;
  const dt = Math.min(0.1, last ? (ts - last) / 1000 : 0); last = ts;
  if (!userOpen()) step(dt);
  render(); frame();
}

const view = $("view");
// where the pointer is, in the view's half-size character cells
const aimAt = (ev) => { const r = view.getBoundingClientRect(); P.aim = Math.max(0, Math.min(W - 1, (ev.clientX - r.left) / r.width * W)); P.aimY = Math.max(1, Math.min(H - GUN.length - 2, (ev.clientY - r.top) / r.height * H)); };   // the crosshair stays above the gun
// on the whole game, not just the view: a message box sits over the view and would swallow the pointer moving across it
$("game").addEventListener("pointermove", (ev) => { if (P) aimAt(ev); });
view.addEventListener("pointerdown", (ev) => { if (!P) return; ev.preventDefault(); aimAt(ev); shoot(P.aim, P.aimY); });
// a click on a message box closes it (and isn't a shot)
$("banner").addEventListener("pointerdown", (ev) => { ev.preventDefault(); $("banner").hidden = true; bannerT = 0; });

$("version").textContent = "v" + VERSION;
setupAccount((name) => { myName = name; });
// pointerdown, not click: the frame is redrawn 15 times a second, so the span pressed may be gone by the release
$("frame").addEventListener("pointerdown", (ev) => { const s = ev.target.closest("[data-k]"); if (!s || !P) return; if (s.dataset.k === "u") openPlayer(); else if (s.dataset.k === "esc") closePlayer(); });
addEventListener("keydown", (ev) => { if (!userOpen() && P && (ev.key === "u" || ev.key === "U") && !ev.metaKey && !ev.ctrlKey && !ev.altKey) { ev.preventDefault(); openPlayer(); } });

// ---- today's corridor from the server -----------------------------------------------------------------------
frame("LOADING TODAY'S CORRIDOR...");
fetch("/api/today").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((t) => {
  day = t.day; SEED = t.seed; myName = t.name;
  if (t.run) showSealed(t.run); else build();
  requestAnimationFrame(loop);
}).catch(() => frame("CAN'T REACH THE SERVER. RELOAD TO TRY AGAIN."));
