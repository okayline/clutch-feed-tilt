# CLUTCH FEED TILT

A daily ASCII corridor shooter. Everyone gets the same seeded map each UTC day: 4Dungeon's wings, with rails that turn through them. Your squad pushes in and falls, you're left 1v3, and the run calls you **CLUTCH**, **FEED** or **TILT**.

- `public/` the page (`index.html`, `app.js`) and the rules (`engine/corridor.js`)
- `public/engine/floor.js` 4Dungeon's wing generator and minimap, copied unchanged from irl-dungeon `public/floor.js`
- `public/account.js` the ACCOUNT panel: save codes and passkeys (the shared Accounts in dungeon-items)
- `src/worker.js` the Cloudflare Worker: serves the page, `GET /api/today` (today's date, seed and your sealed run), `POST /api/run` (seal today's run) and the account routes
- `src/ledger.js` the ledger: one SHA-256 hash chain, one entry per run
- `schema.sql` and `migrations/` the D1 database `cft-db` (players, their devices, runs and the ledger)
- `npm test` runs the tests (Node's built-in test runner, no dependencies)

Font: VT323 by Peter Hull, SIL Open Font License (`public/fonts/OFL.txt`).
