# CLUTCH FEED TILT

A daily ASCII corridor shooter. Everyone gets the same seeded corridor each UTC day. Your squad pushes in and falls, you're left 1v3, and the run calls you **CLUTCH**, **FEED** or **TILT**.

- `public/` the page (`index.html`, `app.js`) and the rules (`engine/corridor.js`)
- `public/account.js` the ACCOUNT panel: save codes and passkeys (the shared Accounts in dungeon-items)
- `src/worker.js` the Cloudflare Worker: serves the page, `GET /api/today` (today's date and seed) and the account routes
- `schema.sql` and `migrations/` the D1 database `cft-db` (players and their devices)
- `npm test` runs the tests (Node's built-in test runner, no dependencies)

Font: VT323 by Peter Hull, SIL Open Font License (`public/fonts/OFL.txt`).
