import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as C from "../public/engine/corridor.js";
import { VERSION } from "../public/engine/version.js";

test("a corridor: the same seed gives the same corridor; 3 enemies in open alcoves; 4 teammates", () => {
  const a = C.corridor(12345), b = C.corridor(12345);
  assert.deepEqual(a, b);
  assert.equal(a.enemies.length, 3);
  for (const e of a.enemies) {
    assert.ok(a.open[Math.floor(e.y)][Math.floor(e.x)], "an enemy waits in an open cell");
    assert.ok([1.5, 5.5].includes(e.x), "in an alcove beside the corridor");
  }
  assert.deepEqual(a.squad.map((m) => m.tag), ["ghost", "ghost", "ghost", "bot"]);
  assert.equal(a.open[C.ML - 1][3], false, "the far wall is closed");
  assert.notDeepEqual(C.corridor(1).enemies, C.corridor(2).enemies, "another day, another corridor");
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
