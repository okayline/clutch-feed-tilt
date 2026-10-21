// The page: draws the frame and the view, runs the fight, and names the run. The rules are in engine/corridor.js.
import * as C from "./engine/corridor.js";
import { VERSION } from "./engine/version.js";
import { setupAccount, openPlayer, closePlayer, isOpen as userOpen } from "./account.js";

const W = 94, H = 34;                // the view window at half-size characters: 47 x 17 cells of the frame, doubled
const FW = 80, PW = 30, VWc = 47;
const $ = (id) => document.getElementById(id);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// the gun, at the bottom of the view (drawn in render())
const GUN = ["      ||      ", "      ||      ", "     /##\\     ", "    /####\\    ", "   /######\\   ", "  /########\\  ", " |##########| "];

let day = "", SEED = 0, myName = null;
let open, enemies, squad, feed, P;
const isOpen = (x, y) => x >= 0 && y >= 0 && x < C.MW && y < C.ML && open[y][x];

// ---- a run --------------------------------------------------------------------------------------------------
function build() {
  const cor = C.corridor(SEED);
  open = cor.open;
  enemies = cor.enemies.map((e) => ({ ...e, hx: e.x, state: "hidden", out: 0, dieT: 0 }));
  squad = cor.squad.map((m) => ({ ...m, k: 0, dead: false }));
  // What the teammates did, replayed as kill-feed lines: two of them trade, then all four go down.
  const s = squad, t0 = cor.t0;
  P = {
    y: C.START, t: 0, hp: C.HP, shots: 0, hits: 0, streak: 0, aim: W / 2, gx: W / 2, aimY: H / 2 - 1, jit: 0, flash: 0, hurt: 0,
    left: C.ENEMIES, phase: "push", done: null, log: [],
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
const ch = Array.from({ length: H }, () => new Array(W).fill(" "));
const cl = Array.from({ length: H }, () => new Array(W).fill(""));
const zbuf = new Float64Array(W);
const put = (x, y, c, k) => { if (x >= 0 && x < W && y >= 0 && y < H) { ch[y][x] = c; cl[y][x] = k; } };

function render() {
  for (let y = 0; y < H; y++) { ch[y].fill(" "); cl[y].fill(""); }
  const px = 3.5, py = P.y;
  for (let x = 0; x < W; x++) {
    const cam = 2 * x / W - 1, rdx = 0.66 * cam, rdy = 1;
    let mx = Math.floor(px), my = Math.floor(py);
    const ddx = Math.abs(1 / (rdx || 1e-9)), ddy = Math.abs(1 / rdy);
    const sx = rdx < 0 ? -1 : 1;
    let sdx = rdx < 0 ? (px - mx) * ddx : (mx + 1 - px) * ddx, sdy = (my + 1 - py) * ddy, side = 0;
    for (let i = 0; i < 80; i++) {
      if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += 1; side = 1; }
      if (!isOpen(mx, my)) break;
    }
    const d = side === 0 ? sdx - ddx : sdy - ddy;
    zbuf[x] = d;
    const hit = side === 0 ? py + d * rdy : px + d * rdx, frac = hit - Math.floor(hit);
    const wh = H / d, top = Math.round(H / 2 - wh / 2), bot = Math.round(H / 2 + wh / 2);
    const r = Math.min(RAMP.length - 1, Math.floor(d / 1.6) + (side === 1 ? 1 : 0));
    const seam = side === 0 && (frac < 0.06 || frac > 0.94) && d < 9;
    for (let y = Math.max(0, top); y < Math.min(H, bot); y++) {
      put(x, y, seam ? "|" : (y === top || y === bot - 1) && d < 12 ? "_" : RAMP[r], d > 14 ? "d" : d > 7 ? "t" : "");
    }
    // the floor grid
    for (let y = Math.max(bot, H / 2 + 1); y < H; y++) {
      const rd = H / (2 * (y + 0.5 - H / 2)); if (rd >= d) continue;
      const wx = px + rd * rdx, fx = wx - Math.floor(wx);
      if (fx < 0.05) put(x, y, ".", rd > 6 ? "d" : "t");
    }
  }
  // enemies, far to near
  const vis = enemies.filter((e) => e.state !== "hidden" || e.y - py < 9).sort((a, b) => (b.y - py) - (a.y - py));
  for (const e of vis) {
    const rx = e.x - px, ry = e.y - py; if (ry < 0.3) continue;
    const sxc = (W / 2) * (1 + rx / 0.66 / ry);
    let sh = H * 0.8 / ry; const sw = 0.5 * W / (1.32 * ry);
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
  // the gun: at the bottom, under the crosshair, sliding left and right after it (P.gx eases toward P.aim in step())
  const gx = Math.round(P.gx) - 7, gy = H - GUN.length + (P.flash > 0 ? 1 : 0);
  GUN.forEach((s, i) => { for (let k = 0; k < s.length; k++) if (s[k] !== " ") put(gx + k, gy + i, s[k], P.flash > 0 && i < 2 ? "g" : "t"); });

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
    ...Array.from({ length: 6 }, () => [[""]]),
    [[rule, "d"]],
    [[` SHOTS ${String(P.shots).padStart(2, "0")}  HITS ${String(P.hits).padStart(2, "0")}  ACC ${String(acc).padStart(3)}%`, "t"]],
    [[" TILT ", "t"], ["[" + "#".repeat(tilt) + ".".repeat(5 - tilt) + "]", tilt >= 3 ? "e" : tilt ? "g" : "d"], ["     " + time, "t"]],
  ];
  const status = (userOpen() ? [[" USER: SAVE CODES AND PASSKEYS. THE RUN WAITS.", "t"]]
    : P.done ? [[" RUN OVER. ", "b"], ["RUNS AREN'T SAVED YET.", "t"]]
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
  // nothing to shoot at yet: the gun fires, but it isn't a shot taken (no miss, no tilt)
  if (!enemies.some((e) => e.state === "out" || e.state === "stepping")) return;
  P.shots++;
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
  const kind = C.label(P);
  P.done = kind;
  const lines = {
    CLUTCH: [["", ""], [" CLUTCH ", "big g"], ["", ""], [`1v3 ON ${P.hp} HP`, "b"], [`${P.hits} hits from ${P.shots} shots`, "t"]],
    TILT: [["", ""], [" TILT ", "big g"], ["", ""], ["Won it, but the crosshair", "b"], ["was shaking the whole time.", "b"]],
    FEED: [["", ""], [" FEED ", "big e"], ["", ""], ["Gave away free kills.", "b"], [`${P.left} ${P.left === 1 ? "enemy" : "enemies"} still up`, "t"]],
  }[kind];
  lines.push(["", ""]);
  showBanner(lines, Infinity);
}

function step(dt) {
  P.t += dt; P.gx += (P.aim - P.gx) * Math.min(1, dt * 14); P.flash = Math.max(0, P.flash - dt); P.hurt = Math.max(0, P.hurt - dt);
  $("view").classList.toggle("hurt", P.hurt > 0);
  if (bannerT !== Infinity) { bannerT -= dt; if (bannerT <= 0) $("banner").hidden = true; }
  while (P.script.length && P.script[0][0] <= P.t) P.script.shift()[1]();
  P.jit = P.streak >= 2 ? (Math.sin(P.t * 23) + Math.sin(P.t * 37)) * (Math.min(5, P.streak) - 1) * 0.7 : 0;
  if (P.done) return;

  const active = enemies.filter((e) => e.state === "stepping" || e.state === "out");
  const next = enemies.find((e) => e.state === "hidden" && e.y - P.y < 4.2);
  if (next && P.phase !== "push") enemies.filter((e) => e.state === "hidden" && Math.abs(e.y - next.y) < 1).forEach((e) => e.state = "stepping");
  const stopAt = Math.min(...enemies.filter((e) => e.state === "hidden").map((e) => e.y - 4.0), C.END);
  if (!active.length && !next) P.y = Math.min(stopAt, P.y + 1.25 * dt);

  for (const e of enemies) {
    if (e.state === "stepping") { e.out = Math.min(1, e.out + dt / 0.45); e.x = e.hx + (e.tx - e.hx) * e.out; if (e.out >= 1) e.state = "out"; }
    else if (e.state === "out") {
      e.fire -= dt;
      if (e.fire <= 0) {
        e.fire = 1.7; P.hp--; P.hurt = 0.25; say("ENEMY hit YOU", "e");
        if (!reduced) { $("game").classList.remove("shake"); void $("game").offsetWidth; $("game").classList.add("shake"); }
        if (P.hp <= 0) { P.hp = 0; finish(); return; }
      }
    } else if (e.state === "dying") { e.dieT += dt; if (e.dieT > 0.5) e.state = "dead"; }
  }
  if (enemies.every((e) => e.state === "dead") && P.y >= C.END - 0.01) finish();
}

let last = 0;
function loop(ts) {
  const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0); last = ts;
  if (!userOpen()) step(dt);
  render(); frame();
  requestAnimationFrame(loop);
}

const view = $("view");
// where the pointer is, in the view's half-size character cells
const aimAt = (ev) => { const r = view.getBoundingClientRect(); P.aim = Math.max(0, Math.min(W - 1, (ev.clientX - r.left) / r.width * W)); P.aimY = Math.max(1, Math.min(H - GUN.length - 2, (ev.clientY - r.top) / r.height * H)); };   // the crosshair stays above the gun
// on the whole game, not just the view: a message box sits over the view and would swallow the pointer moving across it
$("game").addEventListener("pointermove", (ev) => { if (P) aimAt(ev); });
view.addEventListener("pointerdown", (ev) => { if (!P) return; ev.preventDefault(); aimAt(ev); shoot(P.aim, P.aimY); });
// a click on a message box closes it (and isn't a shot)
$("banner").addEventListener("pointerdown", (ev) => { ev.preventDefault(); $("banner").hidden = true; bannerT = 0; });
$("again").addEventListener("click", () => { if (!P) return; build(); $("banner").hidden = true; bannerT = 0; });

$("version").textContent = "v" + VERSION;
setupAccount((name) => { myName = name; });
// pointerdown, not click: the frame is redrawn every animation frame, so the span pressed may be gone by the release
$("frame").addEventListener("pointerdown", (ev) => { const s = ev.target.closest("[data-k]"); if (!s || !P) return; if (s.dataset.k === "u") openPlayer(); else if (s.dataset.k === "esc") closePlayer(); });
addEventListener("keydown", (ev) => { if (!userOpen() && P && (ev.key === "u" || ev.key === "U") && !ev.metaKey && !ev.ctrlKey && !ev.altKey) { ev.preventDefault(); openPlayer(); } });

// ---- today's corridor from the server -----------------------------------------------------------------------
frame("LOADING TODAY'S CORRIDOR...");
fetch("/api/today").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((t) => {
  day = t.day; SEED = t.seed; myName = t.name;
  build();
  requestAnimationFrame(loop);
}).catch(() => frame("CAN'T REACH THE SERVER. RELOAD TO TRY AGAIN."));
