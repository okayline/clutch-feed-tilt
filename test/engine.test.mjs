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
  assert.deepEqual([C.level("2026-10-28").name, C.level("2026-10-28").wing], ["B2F", 2]);
  assert.equal(C.level("2026-10-19").seed, C.level("2026-10-24").seed, "one floor for the whole quarter");
  assert.notEqual(C.level("2026-10-21").seed, C.level("2026-10-28").seed);
});

const MAPS = [[1, "2026-10-21"], [2, "2026-10-14"], [3, "2026-10-19"], [12345, "2026-10-24"], [3359765128, "2026-10-28"]];

test("a map: the same seed gives the same map; you start in the first room facing the next; 5 enemies in notches, 2 guarding the exit", () => {
  const day = "2026-10-21";
  assert.deepEqual(C.corridor(12345, day), C.corridor(12345, day));
  assert.notDeepEqual(C.corridor(1, day).open, C.corridor(2, day).open, "another seed, other doors");
  for (const [seed, d] of MAPS) {
    const c = C.corridor(seed, d), S = C.S;
    assert.ok(c.route.length >= 3, `seed ${seed}: at least 3 rooms from the start to the goal`);
    assert.equal(c.goal, c.route[c.route.length - 1]);
    assert.equal(C.roomOf(c, c.start.x, c.start.y), c.route[0], "you start in the first room");
    assert.ok(c.open[Math.floor(c.start.y)][Math.floor(c.start.x)]);
    // facing the next room: a quarter turn is TURN / 4, so the next room is 7 tiles that way
    const [dy, dx] = C.sincos(c.start.a * 2 * Math.PI / C.TURN), nx = c.start.x + Math.round(dx) * S, ny = c.start.y + Math.round(dy) * S;
    assert.equal(C.roomOf(c, nx, ny), c.route[1]);
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
  const c = C.corridor(12345, "2026-10-21"), R = C.newRun(c);
  const { x, y, a } = R, [dy, dx] = C.sincos(a * 2 * Math.PI / C.TURN);
  C.press(R, 1); C.tick(R);
  assert.ok(Math.abs(R.x - (x + dx * 0.2)) < 1e-12 && Math.abs(R.y - (y + dy * 0.2)) < 1e-12, "3 tiles a second is 0.2 a tick");
  C.turn(R, C.TURN / 4); C.turn(R, C.TURN / 4); C.turn(R, -C.TURN / 4);
  assert.equal(R.a, (a + C.TURN / 4) % C.TURN);
  assert.deepEqual(R.log, [[0, 0, 1], [1, 1, C.TURN / 4]], "keys logged when they change; turns in one tick logged as one");
  // walk at the wall to your right for 3 seconds: you end up against it, never in it
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
    const cor = C.corridor(seed, d), live = playBot(cor, { shootWall: 7 });
    assert.ok(live.escaped, `seed ${seed}: the bot got out`);
    assert.ok(live.enemies.filter((e) => e.guard).every((e) => e.state === "dead" || e.state === "dying"), "past both guards");
    assert.ok(live.shots > live.hits, "and some misses");
    const again = C.replay(C.corridor(seed, d), live.log.map((s) => s.slice(0, 3)));
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

test("an enemy takes 3 body shots; a headshot counts 2; the head is the drawn @ only", () => {
  const [R, a, box] = faceFirst(C.corridor(12345, "2026-10-21")), legs = box.bot - 1;
  assert.deepEqual([C.fire(R, legs), C.fire(R, legs), C.fire(R, legs)], ["body", "body", "kill"]);
  assert.equal(a.state, "dying");
  assert.deepEqual([C.onHead(box, C.AIM, box.top), C.onHead(box, C.AIM, box.top - 1)], [true, false], "no spare row above the head");
  assert.deepEqual([R.hits, R.kills], [3, 1]);
  const [Q, b, bb] = faceFirst(C.corridor(12345, "2026-10-21"));
  assert.deepEqual([C.fire(Q, bb.top), C.fire(Q, bb.bot - 1)], ["head", "kill"], "a headshot (2) leaves it up; a body shot (1) then drops it");
  assert.equal(b.state, "dying");
});

test("tilt: a miss adds 0.25 with no enemy on the view; with one on it, 1.5 and at least 3 (of 5)", () => {
  const R0 = C.newRun(C.corridor(12345, "2026-10-21"));
  assert.equal(C.fire(R0, 10), false); assert.equal(R0.streak, 0.25);
  const [R, , b] = faceFirst(C.corridor(12345, "2026-10-21"));
  C.turn(R, 80);   // 80 units is 7 degrees: the enemy is about 10 columns left of the crosshair, still on the view
  assert.ok(C.enemyBox(C.eyeOf(R), R.enemies.find((e) => e.state === "out")).rr < C.AIM - 2);
  assert.equal(C.fire(R, b.top), "miss"); assert.equal(R.streak, 3);
  C.fire(R, b.top); assert.equal(R.streak, 4.5);
});

test("an enemy can't see you through a wall: standing still in the first room, nobody wakes and you time out", () => {
  const R = C.replay(C.corridor(12345, "2026-10-21"), []);
  assert.deepEqual([R.hp, R.tick, R.escaped, C.label(R)], [3, C.MAX_TICKS, false, "FEED"]);
  assert.ok(R.enemies.every((e) => e.state === "hidden"));
});

test("replay: inputs that aren't a run are refused", () => {
  const cor = C.corridor(12345, "2026-10-21");
  assert.equal(C.replay(cor, [[5, 0, 1], [4, 0, 0]]), null, "out of order");
  assert.equal(C.replay(cor, [[C.MAX_TICKS + 1, 0, 1]]), null, "after the end");
  assert.equal(C.replay(cor, [[5, 0, 16]]), null, "no such keys");
  assert.equal(C.replay(cor, [[5, 1, 0.5]]), null, "a turn is a whole number");
  assert.equal(C.replay(cor, [[5, 2, 30]]), null, "below the crosshair's reach");
  assert.equal(C.replay(cor, [[5, 3, 1]]), null, "no such input");
  assert.equal(C.replay(cor, [[5.5, 0, 1]]), null, "a tick is a whole number");
  assert.equal(C.replay(cor, "nope"), null);
});
