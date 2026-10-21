import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as C from "../public/engine/corridor.js";
import { VERSION } from "../public/engine/version.js";

test("the 4Dungeon level of a day: the moon quarter at 00:00 UTC, one wing a day", () => {
  // the mean moon's first quarter fell on Oct 18 2026 and its full on Oct 26 (by the 29.53 day month from
  // 2000-01-06 18:14 UTC): Oct 21 is the 2nd quarter (B3F), 3 days in; Oct 28 is the 3rd (B2F), 2 days in
  assert.deepEqual([C.level("2026-10-21").name, C.level("2026-10-21").wing], ["B3F", 3]);
  assert.deepEqual([C.level("2026-10-28").name, C.level("2026-10-28").wing], ["B2F", 2]);
  assert.equal(C.level("2026-10-19").seed, C.level("2026-10-24").seed, "one floor for the whole quarter");
  assert.notEqual(C.level("2026-10-21").seed, C.level("2026-10-28").seed);
});

test("a map: the same seed gives the same map; the rails run through open tiles from room to room; 3 enemies in notches; 4 teammates", () => {
  const day = "2026-10-21";
  const a = C.corridor(12345, day), b = C.corridor(12345, day);
  assert.deepEqual(a, b);
  assert.notDeepEqual(C.corridor(1, day).path, C.corridor(2, day).path, "another seed, other doors");
  for (const [seed, d] of [[1, day], [2, "2026-10-14"], [3, "2026-10-19"], [12345, "2026-10-24"], [3359765128, "2026-10-28"]]) {
    const c = C.corridor(seed, d);
    assert.ok(c.route.length >= 4, "at least 4 rooms on the rails");
    // every step between rooms is one room (7 tiles) north, east, south or west, through open tiles all the way
    for (let i = 1; i < c.path.length; i++) {
      const p = c.path[i - 1], q = c.path[i];
      assert.equal(Math.abs(q.x - p.x) + Math.abs(q.y - p.y), 7);
      for (let t = 0; t <= 7; t++) assert.ok(c.open[Math.floor(p.y + (q.y - p.y) * t / 7)][Math.floor(p.x + (q.x - p.x) * t / 7)], `seed ${seed}: the rails are open`);
    }
    assert.ok(new Set(c.path.slice(1).map((q, i) => (q.x - c.path[i].x) + "," + (q.y - c.path[i].y))).size > 1, `seed ${seed}: the rails turn`);
    assert.equal(c.enemies.length, 3);
    for (const e of c.enemies) {
      assert.ok(c.open[Math.floor(e.y)][Math.floor(e.x)], "an enemy waits in an open notch");
      assert.ok(c.open[Math.floor(e.ty)][Math.floor(e.tx)], "and steps out into the room");
      assert.ok(e.s > 0 && e.s <= c.end + 3);
    }
    assert.deepEqual(c.squad.map((m) => m.tag), ["ghost", "ghost", "ghost", "bot"]);
  }
});

test("along the rails: halfway between two rooms you are halfway and face the way the rails go; turns are on the spot in 15 degree jumps", () => {
  const path = [{ x: 3.5, y: 3.5 }, { x: 10.5, y: 3.5 }, { x: 10.5, y: 10.5 }];   // east, then south
  assert.deepEqual(C.turns(path), [1]);
  assert.deepEqual(C.along(path, 3.5), { x: 7, y: 3.5, dx: 1, dy: 0 });
  const deg = (s, e) => { const r = C.along(path, s, e); return [r.x, r.y, Math.round(Math.atan2(r.dy, r.dx) * 180 / Math.PI)]; };
  assert.deepEqual(deg(7, 0), [10.5, 3.5, 0]);      // on the turning room's centre: still facing the way in
  assert.deepEqual(deg(7, 0.5), [10.5, 3.5, 45]);   // halfway round: 3 of 6 jumps
  assert.deepEqual(deg(7, 0.99), [10.5, 3.5, 75]);  // never in between jumps: 5 of 6
  assert.deepEqual(deg(10.5, 0), [10.5, 7, 90]);    // past it: facing the way out
});

test("the label: died = FEED; won with shots > 2.5 x hits = TILT; else CLUTCH", () => {
  assert.equal(C.label({ hp: 0, shots: 3, hits: 3 }), "FEED");
  assert.equal(C.label({ hp: 1, shots: 8, hits: 3 }), "TILT");     // 8 > 7.5
  assert.equal(C.label({ hp: 1, shots: 7, hits: 3 }), "CLUTCH");   // 7 <= 7.5
});

test("VERSION matches the newest CHANGELOG heading", () => {
  const m = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8").match(/^## v(\S+)/m);
  assert.equal(m[1], VERSION);
});
