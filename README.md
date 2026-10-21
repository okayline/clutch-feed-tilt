# CLUTCH FEED TILT

A daily ASCII corridor shooter. Everyone gets the same seeded corridor each UTC day. Your squad pushes in and falls, you're left 1v3, and the run calls you **CLUTCH**, **FEED** or **TILT**.

- `public/` the page (`index.html`, `app.js`) and the rules (`engine/corridor.js`)
- `src/worker.js` the Cloudflare Worker: serves the page and `GET /api/today` (today's date and seed)
- `npm test` runs the tests (Node's built-in test runner, no dependencies)

Font: VT323 by Peter Hull, SIL Open Font License (`public/fonts/OFL.txt`).
