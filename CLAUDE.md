# clutch-feed-tilt: working notes

## This repo

TILT.EXE: a daily ASCII corridor shooter. One corridor per UTC day, the same for everyone; your run is labelled CLUTCH, FEED or TILT. The repo, Worker, D1, ledger and registry ids all stay `clutch-feed-tilt` / `cft`; the player-facing name was CLUTCH FEED TILT until v0.10.1. Rules doc: the Claude Doc "CLUTCH FEED TILT: rules" (https://claude.ai/artifact/LeYcKUbq78EKJfsaYQwX4H). Treat a push to `main` as a release: the Worker may be connected to this repo.

- **The rules live in one file**, `public/engine/corridor.js`, loaded by the page and the tests. Change a rule there, once.
- **`public/engine/floor.js` is irl-dungeon's `public/floor.js`, byte for byte** (itself trimmed from 4Dungeon's `floor.js`): the wing generator and minimap. Don't edit it here; a fix goes in irl-dungeon (and 4Dungeon) and is copied over whole, so `diff` against irl-dungeon stays empty.
- **The ledger makes the map.** The first request of each UTC day seals a `day` ledger entry (`src/ledger.js` `dayEntry`). The first 4 bytes of its hash are the day's seed (`/api/today`), which picks the floor's doors. The entry's `wing` is how far the floor is open: the furthest wing 4Dungeon's players opened this quarter, read once from 4Dungeon's board (`DUNGEON`, the daily-dungeon-board D1, read only; `wingsOpened` in `src/worker.js`).
- **The wings are the real 4Dungeon floor of that moon quarter.** `level()` in `public/engine/corridor.js` copies 4Dungeon's moon quarter (`daily-dungeon/screen.js` QREF, QLEN), `hash`, `seedFrom` and the level names (`daily-dungeon/rules.js`) unchanged. If 4Dungeon changes those, copy them again.
- **Save codes and passkeys are the shared Accounts service** (dungeon-items `ACCOUNTS.md`, bound here as `ACCOUNTS`, game name `clutch-feed-tilt`). This game keeps only its own players, sessions and cookie (`cft`). The account code in `src/worker.js` is copied from aura-farm.
- **Database changes** need a file in `migrations/`, `schema.sql` updated to match, and the live `cft-db` migrated before the push that needs it.
- The frame, font and colours are copied from 4Dungeon (`daily-dungeon/index.html`, `screen.js`). `public/fonts/VT323-Regular.ttf` is OFL (see `public/fonts/OFL.txt`).
- **Testing:** `npm test` must pass before any commit, plus one quick check of whatever changed. Expected values come from hand-worked examples or node:crypto, not the code under test.
- **Releases:** every release bumps `VERSION` in `public/engine/version.js` and adds a `CHANGELOG.md` entry (a test checks they match). The detailed dev entries are in dungeon-notes `clutch-feed-tilt/changelog-v0.1.md`. No browser popups (confirm/alert/prompt).
