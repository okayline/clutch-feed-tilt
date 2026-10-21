import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as C from "../public/engine/corridor.js";
import { VERSION } from "../public/engine/version.js";

test("a map: the same seed gives the same map; the rails run through open tiles from room to room; 3 enemies in notches; 4 teammates", () => {
  const a = C.corridor(12345), b = C.corridor(12345);
  assert.deepEqual(a, b);
  assert.notDeepEqual(C.corridor(1).path, C.corridor(2).path, "another day, another map");
  for (const seed of [1, 2, 3, 12345, 3359765128]) {
    const c = C.corridor(seed);
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

test("along the rails: halfway between two rooms you are halfway and face the way the rails go; turns go in 15 degree jumps", () => {
  const path = [{ x: 3.5, y: 3.5 }, { x: 10.5, y: 3.5 }, { x: 10.5, y: 10.5 }];   // east, then south
  assert.deepEqual(C.along(path, 3.5), { x: 7, y: 3.5, dx: 1, dy: 0 });
  const mid = C.along(path, 7);   // at the turn: halfway round, facing south-east
  assert.ok(Math.abs(mid.dx - Math.SQRT1_2) < 1e-9 && Math.abs(mid.dy - Math.SQRT1_2) < 1e-9);
  for (let s = 5.5; s <= 8.5; s += 0.1) {   // through the turn you face in jumps of 15 degrees, never in between
    const r = C.along(path, s), deg = Math.atan2(r.dy, r.dx) * 180 / Math.PI;
    assert.ok(Math.abs(deg / 15 - Math.round(deg / 15)) < 1e-6, `at ${s.toFixed(1)}: ${deg} degrees`);
  }
  const after = C.along(path, 10.5);
  assert.ok(Math.abs(after.x - 10.5) < 1e-9 && Math.abs(after.y - 7) < 1e-9 && Math.abs(after.dy - 1) < 1e-9);
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
