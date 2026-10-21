# Working notes for clutch-feed-tilt

CLUTCH FEED TILT: a daily ASCII corridor shooter. One corridor per UTC day, the same for everyone; your run is labelled CLUTCH, FEED or TILT. Rules doc: the Claude Doc "CLUTCH FEED TILT: rules" (https://claude.ai/artifact/LeYcKUbq78EKJfsaYQwX4H).

- **Push only when the user says to.** Once the Worker is connected to this repo, a push to `main` is a release.
- **The rules live in one file**, `public/engine/corridor.js`, loaded by the page and the tests. Change a rule there, once.
- **Database changes** need a file in `migrations/`, `schema.sql` updated to match, and the live `cft-db` migrated before the push that needs it.
- **Save codes and passkeys are the shared Accounts service** (dungeon-items `ACCOUNTS.md`, bound here as `ACCOUNTS`, game name `clutch-feed-tilt`). This game keeps only its own players, sessions and cookie (`cft`). The account code in `src/worker.js` and `public/account.js` is copied from aura-farm.
- **The day's seed comes from the Worker** (`/api/today`, `src/worker.js`), from the server's clock.
- The frame, font and colours are copied from 4Dungeon (`daily-dungeon/index.html`, `screen.js`); `public/fonts/VT323-Regular.ttf` is OFL (see `OFL.txt`).
- **Keep testing quick**: `npm test` must pass before any commit, plus one quick check of whatever changed. Expected values come from hand-worked examples or node:crypto, not the code under test.
- Every release bumps `VERSION` in `public/engine/version.js` and adds a `CHANGELOG.md` entry (a test checks they match). No new dependencies without asking. Times in changelogs are Hawaii time (HST). No browser popups (confirm/alert/prompt).

## Working rules

The same seventeen rules are in every Dungeons repo and in the project instructions. "ryan" is the owner.

**Honesty (never broken)**
1. Never lie. State as fact only what you opened, read or ran this turn. Everything else gets "Not checked" in the same sentence, or isn't said.
2. Don't infer from the surface. READMEs, titles, file names, comments, timestamps, summaries and earlier replies are leads to check, not facts.
3. Quote it or don't claim it. Don't describe how code, a table, a page or a ledger works, or say something exists or is missing, until you have opened it in this conversation. Give file and line, quoted.
4. Opinions are labelled "my opinion". Hedges like "should work" or "probably" are labelled "not checked".
5. Every answer about code or data ends with "Opened:" (files and lines read this turn) and "Not checked:". If "Opened:" would be empty, open the files before answering.
6. Check first, then reply once. No "I'll look into it" message followed by an answer from memory.
7. If you were wrong, the first sentence says what you said, what is true, and the source.
8. Never say something was done, pushed or fixed unless you saw it succeed. Say what ran and what didn't, and report failures plainly.

**Searching**
9. Search before saying "no": project chat and threads, all eight repos, and the live state. List what was and wasn't searched. Say "I couldn't find it", never "that isn't true", and never "everything". Treat ryan's memory as true until a search disproves it.
10. Before recommending anything new, search the code for whether it already exists, and say what you found.

**Design and proposals**
11. Give honest design answers, including "this isn't worth building". Give one recommendation. Mention "do nothing" only if it is actually the best option. Never tell ryan to play or playtest the game.
12. Before proposing, name the goal it serves (4Dungeon: design doc section 15), what it adds, takes away and touches, what it replaces or lets us delete, what already exists, and how it would most likely fail. No goal means no proposal. Propose the smallest version first.

**Building**
13. Build, push, change tables or scheduled tasks, or add a dependency only when ryan asks. Don't touch anything not asked for, and list extras for approval.
14. Delete, don't park: no new flags or "off for now" code. Fix a shared problem once, in the shared place.
15. Each changelog line says what was removed as well as what was added.

**Working with ryan**
16. Silence means "not now": no nagging, and raise each item at most once.
17. Disagree before building, not after. A bare "ok" to a long answer is not approval of everything in it.
