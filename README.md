# TILT.EXE

A daily ASCII corridor shooter. Everyone gets the same map each UTC day: two wings of that moon quarter's real 4Dungeon floor, with the doors opened by the day's ledger entry and rails that turn through them. Your squad pushes in and falls, you're left 1v3, and the run calls you **CLUTCH**, **FEED** or **TILT**.

- `public/` the page (`index.html`, `app.js`) and the rules (`engine/corridor.js`)
- `public/engine/floor.js` 4Dungeon's wing generator and minimap, copied unchanged from irl-dungeon `public/floor.js`
- `public/account.js` the ACCOUNT panel: save codes and passkeys (the shared Accounts in dungeon-items)
- `src/worker.js` the Cloudflare Worker: serves the page, `GET /api/today` (today's date, the seed from today's ledger entry, and your sealed run), `POST /api/run` (seal today's run) and the account routes
- `src/ledger.js` the ledger: one SHA-256 hash chain, one entry per run
- `schema.sql` and `migrations/` the D1 database `cft-db` (players, their devices, runs and the ledger)
- `npm test` runs the tests (Node's built-in test runner, no dependencies)

Font: VT323 by Peter Hull, SIL Open Font License (`public/fonts/OFL.txt`).
