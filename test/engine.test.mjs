import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as C from "../public/engine/corridor.js";
import { VERSION } from "../public/engine/version.js";
import { playBot } from "./bot.mjs";

test("the 4Dungeon level of a day: the moon quarter at 00:00 UTC, one wing a day", () => {
  // the mean moon's first quarter fell on Oct 18 2026 and its full on Oct 26 (by the 29.53 day month from
  // 2000-01-06 18:14 UTC): Oct 21 is the 2nd quarter (B3F), 3 days in; Oct 28 is the 3rd (B2F), 2 days in
  assert.deepEqual([C.level("2026-10-21").name, C.level("2026-10-21").wing], ["B3F", 3]);
  assert.equal(C.level("2026-10-21").first, 20747 - 3, "the quarter's first UTC day: Oct 21 is day 20747 since 1970, its wing 3 from 0");
  assert.deepEqual([C.level("2026-10-28").name, C.level("2026-10-28").wing], ["B2F", 2]);
  assert.equal(C.level("2026-10-19").seed, C.level("2026-10-24").seed, "one floor for the whole quarter");
  assert.notEqual(C.level("2026-10-21").seed, C.level("2026-10-28").seed);
});

const MAPS = [[1, "2026-10-21", 2], [2, "2026-10-14", 3], [3, "2026-10-19", 4], [12345, "2026-10-24", 6], [3359765128, "2026-10-28", 7]];

test("a map: the same seed gives the same map; you start in the first room facing north; the floor is built as far as it is open; 5 enemies in notches, 2 guarding the exit, the only way to the goal", () => {
  const day = "2026-10-21";
  assert.deepEqual(C.corridor(12345, day, 4), C.corridor(12345, day, 4));
  assert.notDeepEqual(C.corridor(1, day, 4).open, C.corridor(2, day, 4).open, "another seed, other doors");
  for (const [seed, d, wing] of MAPS) {
    const c = C.corridor(seed, d, wing), S = C.S;
    // open as far as `wing`: its wings (1 to wing) and the next one, behind the exit; never fewer than the run's 2 and that
    const wings = new Set(c.floor.rooms.filter(Boolean).map((r) => r.wing));
    assert.equal(wings.size, Math.min(c.floor.wings.length, Math.max(2, wing) + 1), `seed ${seed}: wings built`);
    assert.equal(c.floor.rooms[c.route[c.route.length - 2]].wing, Math.max(2, wing) - 1, `seed ${seed}: the run ends on wing ${wing} (counting from 1)`);
    assert.ok(c.route.length >= 3, `seed ${seed}: at least 3 rooms from the start to the goal`);
    assert.equal(c.goal, c.route[c.route.length - 1]);
    assert.equal(C.roomOf(c, c.start.x, c.start.y), c.route[0], "you start in the first room");
    assert.ok(c.open[Math.floor(c.start.y)][Math.floor(c.start.x)]);
    assert.equal(c.start.a, 3 * C.TURN / 4, "north: three quarters of the way round from east, y grows south");
    // every open room is built, with an open gap at every door the minimap draws open, a locked door's 3 tiles marked
    // where it has none, and a sealed one (the other of an opened offer) plain wall
    const f = c.floor, mid = (S - 1) / 2;
    for (const [i, room] of f.rooms.entries()) {
      if (!room) continue;
      assert.ok(Object.values(c.blocks).some((row) => row.includes(i)), `room ${i} is built`);
      for (const [dir, j] of Object.entries(room.doors)) {
        const [ux, uy] = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[dir];
        const bx = c.blocks.findIndex((row) => row.includes(i)), by = bx, cx = c.blocks[by] ? c.blocks[by].indexOf(i) : -1;
        const x = cx * S + mid + ux * mid, y = by * S + mid + uy * mid;   // the middle tile of the door, on this room's edge
        if (f.rooms[j]) assert.ok(c.open[y][x], `seed ${seed}: room ${i}'s ${dir} door is open`);
        else if (f.sealed && f.sealed[j]) assert.ok(!c.open[y][x] && !c.locked[x + "," + y], `seed ${seed}: room ${i}'s ${dir} door is sealed`);
        else assert.ok(!c.open[y][x] && c.locked[x + "," + y], `seed ${seed}: room ${i}'s ${dir} door is locked`);
      }
    }
    // with the exit shut, the goal can't be reached from the start any other way
    const R = C.newRun(c), seen = new Set([Math.floor(c.start.x) + "," + Math.floor(c.start.y)]), q = [[Math.floor(c.start.x), Math.floor(c.start.y)]];
    while (q.length) { const [x, y] = q.pop(); for (const [dx2, dy2] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (x + dx2) + "," + (y + dy2); if (!seen.has(k) && !C.blocked(R, x + dx2, y + dy2)) { seen.add(k); q.push([x + dx2, y + dy2]); } } }
    assert.ok(![...seen].some((k) => C.roomOf(c, ...k.split(",").map(Number)) === c.goal), `seed ${seed}: the exit is the only way in`);
    // the exit: 3 tiles on the edge of the room before the goal, open on the map (a run shuts it)
    assert.equal(c.exit.length, 3);
    for (const [x, y] of c.exit) { assert.ok(c.open[y][x]); assert.equal(C.roomOf(c, x, y), c.route[c.route.length - 2]); }
    assert.equal(c.enemies.length, 5);
    assert.deepEqual(c.enemies.map((e) => e.guard), [true, true, false, false, false], "the first two guard the exit");
    for (const e of c.enemies) {
      assert.ok(c.open[Math.floor(e.y)][Math.floor(e.x)], "an enemy waits in an open notch");
      assert.ok(c.open[Math.floor(e.ty)][Math.floor(e.tx)], "and steps out into the room");
      assert.equal(C.roomOf(c, e.tx, e.ty), e.room);
      assert.ok(e.room !== c.route[0] && e.room !== c.goal, "never in the first room or the goal");
    }
    assert.equal(new Set(c.enemies.map((e) => e.x + "," + e.y)).size, 5, "one enemy a notch");
  }
});

test("walking: W walks the way you face at 3 tiles a second; walls stop you; turning is in TURN units", () => {
  const c = C.corridor(12345, "2026-10-21", 2), R = C.newRun(c);
  const { x, y, a } = R, [dy, dx] = C.sincos(a * 2 * Math.PI / C.TURN);
  C.press(R, 1); C.tick(R);
  assert.ok(Math.abs(R.x - (x + dx * 0.2)) < 1e-12 && Math.abs(R.y - (y + dy * 0.2)) < 1e-12, "3 tiles a second is 0.2 a tick");
  C.turn(R, C.TURN / 4); C.turn(R, C.TURN / 4); C.turn(R, -C.TURN / 4);
  assert.equal(R.a, (a + C.TURN / 4) % C.TURN);
  assert.deepEqual(R.log, [[0, 0, 1], [1, 1, C.TURN / 4]], "keys logged when they change; turns in one tick logged as one");
  // turn to a side of the first room with no door (E S W N are 0, 1, 2, 3 quarter turns) and walk at it for 3 seconds:
  // you end up against the wall, never in it
  const doors = c.floor.rooms[c.route[0]].doors, side = ["E", "S", "W", "N"].findIndex((d) => doors[d] === undefined);
  C.turn(R, ((side * C.TURN / 4 - R.a) % C.TURN + C.TURN) % C.TURN || C.TURN);
  for (let i = 0; i < 45; i++) C.tick(R);
  assert.ok(C.isOpen(c, Math.floor(R.x), Math.floor(R.y)));
  const before = [R.x, R.y]; C.tick(R);
  assert.deepEqual([R.x, R.y], before, "stopped by the wall");
});

test("the label: died or never got out = FEED; got out with shots > 2.5 x hits = TILT; else CLUTCH", () => {
  assert.equal(C.label({ hp: 0, shots: 3, hits: 3, escaped: false }), "FEED");
  assert.equal(C.label({ hp: 2, shots: 3, hits: 3, escaped: false }), "FEED");
  assert.equal(C.label({ hp: 1, shots: 8, hits: 3, escaped: true }), "TILT");     // 8 > 7.5
  assert.equal(C.label({ hp: 1, shots: 7, hits: 3, escaped: true }), "CLUTCH");   // 7 <= 7.5
});

test("VERSION matches the newest CHANGELOG heading", () => {
  const m = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8").match(/^## v(\S+)/m);
  assert.equal(m[1], VERSION);
});

test("sin, cos and atan2 from + - * / and sqrt: within 1e-15 of Math's, exact at 0 and the quarter turns", () => {
  for (let x = -10; x < 10; x += 0.0137) {
    const [s, c] = C.sincos(x);
    assert.ok(Math.abs(s - Math.sin(x)) < 1e-15 && Math.abs(c - Math.cos(x)) < 1e-15, `x = ${x}`);
  }
  for (let i = 0; i < 2000; i++) { const y = Math.sin(i * 1.3) * 5, x = Math.cos(i * 0.7) * 5; assert.ok(Math.abs(C.atan2(y, x) - Math.atan2(y, x)) < 2e-15); }
  assert.deepEqual(C.sincos(0), [0, 1]);
  assert.deepEqual([C.atan2(0, 1), C.atan2(1, 0), C.atan2(0, -1), C.atan2(-1, 0)], [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
});

test("replay: the same inputs give the same run as playing it live, on every map tried; the exit opens once its guards are down", () => {
  for (const [seed, d] of MAPS) {
    const cor = C.corridor(seed, d, 4), live = playBot(cor, { shootWall: 7 });
    assert.ok(live.escaped, `seed ${seed}: the bot got out`);
    assert.ok(live.enemies.filter((e) => e.guard).every((e) => e.state === "dead" || e.state === "dying"), "past both guards");
    assert.ok(live.shots > live.hits, "and some misses");
    const again = C.replay(C.corridor(seed, d, 4), live.log.map((s) => s.slice(0, 3)));
    assert.deepEqual([again.hp, again.shots, again.hits, again.tick, again.escaped, again.x, again.y, again.log], [live.hp, live.shots, live.hits, live.tick, live.escaped, live.x, live.y, live.log]);
  }
});

// Play the bot's run up to the tick it first shoots (an enemy is out), then stand and face that enemy until it is on
// the middle column: returns the run, the enemy and its box.
function faceFirst(cor) {
  const bot = playBot(cor), first = bot.log.find((s) => s[1] === 2)[0], R = C.newRun(cor);
  for (const [t, k, v] of bot.log) { if (t >= first) break; while (R.tick < t) C.tick(R); if (k === 0) C.press(R, v); else if (k === 1) C.turn(R, v); }
  C.press(R, 0);
  for (let n = 0; n < 60; n++) {
    const e = R.enemies.find((e) => e.state === "out");
    if (e) {
      const want = Math.round(C.atan2(e.y - R.y, e.x - R.x) * C.TURN / (2 * Math.PI));
      C.turn(R, ((((want - R.a) % C.TURN) + C.TURN * 1.5) % C.TURN) - C.TURN / 2);
      const b = C.enemyBox(C.eyeOf(R), e);
      if (b && Math.abs(b.sxc - C.AIM) < 1) return [R, e, b];
    }
    C.tick(R);
  }
  throw new Error("no enemy came out");
}

test("the hitbox is the drawn figure, no spare cell; the crown is the middle 1 of the head's top row (2 if it's even)", () => {
  // a box about 3 tiles away, worked by hand from cell()'s fractions: 14 wide (u = (c - 40) / 14), 9 tall (f = (r - 14) / 9)
  const b = { l: 40, rr: 54, top: 14, bot: 23, sh: 9, kind: "short" };
  // head: f < 0.22 is rows 14-15, |u - 0.5| < 0.2 is cols 45-49; chest rows 16-19 cols 42-52; gun row 17 col 53;
  // legs rows 20-22, cols 43-45 and 49-51, gap 46-48
  assert.deepEqual([45, 49, 44, 50].map((c) => C.cell(b, c, 15)), ["@", "@", "", ""]);
  assert.deepEqual([C.cell(b, 42, 16), C.cell(b, 53, 17), C.cell(b, 43, 21), C.cell(b, 51, 21)], ["#", "=", "|", "|"]);
  assert.deepEqual([C.cell(b, 47, 21), C.cell(b, 44, 14), C.cell(b, 47, 13), C.cell(b, 41, 16), C.cell(b, 47, 23)], ["", "", "", "", ""],
    "leg gap, beside the head, above it, beside the chest, below the feet: all miss");
  assert.deepEqual([44, 45, 46, 47, 48, 49, 50].map((c) => C.onCrown(b, c, 14)), [false, false, false, true, false, false, false]);
  assert.equal(C.onCrown(b, 47, 15), false, "the head's second row is not crown");
  // 6 tiles away the head is 3 wide (cols 46-48): its middle one is crown
  const f = { l: 44, rr: 50, top: 15, bot: 20, sh: 4.5, kind: "short" };   // u = (c - 44) / 6: |u - 0.5| < 0.2 is cols 46-48
  assert.deepEqual([45, 46, 47, 48, 49].map((c) => C.onCrown(f, c, 15)), [false, false, true, false, false]);
  // a head 6 wide (u = (c - 40) / 13, |u - 0.5| < 0.2 is cols 44-49): the middle 2 (46, 47) are crown
  const even = { l: 40, rr: 53, top: 5, bot: 12, sh: 7, kind: "short" };
  assert.deepEqual([43, 44, 45, 46, 47, 48, 49].map((c) => C.onCrown(even, c, 5)), [false, false, false, true, true, false, false]);
  // a drone, 10 wide and 6 tall: its middle is col 44.5, half its width 5, its core 1 either side (cols 44-45);
  // f = (r - 10) / 6, so rows 10-11 are rotors, 12-13 the core, 14-15 the legs
  const dr = { l: 40, rr: 50, top: 10, bot: 16, sh: 6, kind: "drone" };
  for (const spin of [0, 1, 2]) assert.deepEqual([41, 42, 43, 44, 45, 46, 47, 48].map((c) => C.cell(dr, c, 12, spin)), ["-", "-", "[", "O", "O", "]", "-", "-"]);
  assert.deepEqual([44, 45, 43, 40].map((c) => C.cell(dr, c, 10)), [":", ":", "", "-"], "the mast, a gap, then the rotor out to the edge");
  assert.deepEqual([42, 43, 44, 46, 47].map((c) => C.cell(dr, c, 14)), ["/", "/", "", "\\", "\\"]);
  assert.deepEqual(["-", "~", ":", "[", "]", "/", "\\"].map((p) => C.DMG[p]), [undefined, undefined, undefined, undefined, undefined, undefined, undefined], "only the O is a hit");
});

test("short, tall, drone in turn; a drone dies to one hit on its O; a short one: the leg gap misses, 3 chest shots, a double tap, a crown shot", () => {
  assert.deepEqual(C.corridor(12345, "2026-10-21", 2).enemies.map((e) => e.kind), ["short", "tall", "drone", "short", "tall"]);
  const rows = (b, part) => { const out = []; for (let r = b.top; r < b.bot; r++) if (C.cell(b, Math.round(C.AIM), r) === part) out.push(r); return out; };
  const [B, dr, drBox] = faceFirst(C.corridor(12345, "2026-10-21", 2));
  assert.equal(dr.kind, "drone", "the first one out on this map");
  assert.deepEqual([C.fire(B, drBox.top), C.fire(B, rows(drBox, "O")[0]), dr.state], ["miss", "kill", "dying"], "its mast misses, its O drops it");
  const shorts = () => { const cor = C.corridor(12345, "2026-10-21", 2); cor.enemies.forEach((e) => e.kind = "short"); return faceFirst(cor); };
  const [R, a, box] = shorts(), chest = rows(box, "#")[0];
  assert.equal(C.fire(R, box.bot - 1), "miss", "the middle column between the legs");
  assert.deepEqual([C.fire(R, chest), C.fire(R, chest), C.fire(R, chest)], ["body", "body", "kill"]);
  assert.equal(a.state, "dying");
  const [Q, b, bb] = shorts(), head = rows(bb, "@");
  assert.ok(head.length >= 2 && C.onCrown(bb, Math.round(C.AIM), head[0]) && !C.onCrown(bb, Math.round(C.AIM), head[1]));
  assert.deepEqual([C.fire(Q, head[1]), C.fire(Q, chest)], ["head", "kill"], "a headshot (4) leaves it up; a chest shot (2) then drops it");
  assert.equal(b.state, "dying");
  const [S, c, cb] = shorts();
  assert.deepEqual([C.fire(S, cb.top), c.state], ["headkill", "dying"], "the crown drops it at once");
  assert.deepEqual([R.hits, R.kills, Q.heads, S.heads], [3, 1, 1, 1]);
});

test("tilt: a miss adds 0.25 with no enemy on the view; with one on it, 1.5 and at least 3 (of 5)", () => {
  const R0 = C.newRun(C.corridor(12345, "2026-10-21", 2));
  assert.equal(C.fire(R0, 10), false); assert.equal(R0.streak, 0.25);
  const [R, , b] = faceFirst(C.corridor(12345, "2026-10-21", 2));
  C.turn(R, 80);   // 80 units is 7 degrees: the enemy is about 10 columns left of the crosshair, still on the view
  assert.ok(C.enemyBox(C.eyeOf(R), R.enemies.find((e) => e.state === "out")).rr < C.AIM - 2);
  assert.equal(C.fire(R, b.top), "miss"); assert.equal(R.streak, 3);
  C.fire(R, b.top); assert.equal(R.streak, 4.5);
});

test("an enemy can't see you through a wall: standing still in the first room, nobody wakes and you time out", () => {
  const R = C.replay(C.corridor(12345, "2026-10-21", 2), []);
  assert.deepEqual([R.hp, R.tick, R.escaped, C.label(R)], [3, C.MAX_TICKS, false, "FEED"]);
  assert.ok(R.enemies.every((e) => e.state === "hidden"));
});

test("replay: inputs that aren't a run are refused", () => {
  const cor = C.corridor(12345, "2026-10-21", 2);
  assert.equal(C.replay(cor, [[5, 0, 1], [4, 0, 0]]), null, "out of order");
  assert.equal(C.replay(cor, [[C.MAX_TICKS + 1, 0, 1]]), null, "after the end");
  assert.equal(C.replay(cor, [[5, 0, 16]]), null, "no such keys");
  assert.equal(C.replay(cor, [[5, 1, 0.5]]), null, "a turn is a whole number");
  assert.equal(C.replay(cor, [[5, 2, 30]]), null, "below the crosshair's reach");
  assert.equal(C.replay(cor, [[5, 3, 1]]), null, "no such input");
  assert.equal(C.replay(cor, [[5.5, 0, 1]]), null, "a tick is a whole number");
  assert.equal(C.replay(cor, "nope"), null);
});
