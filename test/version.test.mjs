import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VERSION } from "../public/engine/version.js";

test("the shared footer on the page shows the version", () => {
  const page = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.ok(page.includes("/footer.js") && page.includes(`data-version="v${VERSION}"`));
});
