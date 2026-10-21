import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as C from "../public/engine/corridor.js";
import { VERSION } from "../public/engine/version.js";
import worker, { daySeed } from "../src/worker.js";

test("the day's seed: the first 4 bytes of SHA-256('cft:' + day)", async () => {
  const want = parseInt(createHash("sha256").update("cft:2026-10-21").digest("hex").slice(0, 8), 16);
  assert.equal(await daySeed("2026-10-21"), want);
});

test("/api/today gives today's UTC day and its seed", async () => {
  const r = await worker.fetch(new Request("https://x/api/today"), {});
  const t = await r.json();
  assert.equal(t.day, new Date().toISOString().slice(0, 10));
  assert.equal(t.seed, parseInt(createHash("sha256").update("cft:" + t.day).digest("hex").slice(0, 8), 16));
  assert.equal((await worker.fetch(new Request("https://x/api/nope"), {})).status, 404);
});

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
