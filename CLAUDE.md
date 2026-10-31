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

<!-- BEGIN SHARED RULES v7 (2026-10-31). One copy of this block is in every Dungeons repo's CLAUDE.md. The source is dungeon-notes/SHARED-RULES.md. Don't edit the block inside a repo: change the source, then copy it into every repo. -->
## Working rules (shared by every repo)

"kura" is the owner. "4Dungeon" is the repo `daily-dungeon`. Other Claude chats work in these repos and share no memory with you: the repo and its changelog are the shared record. A repo section above beats a rule below, except rules 1 to 4.

**Honesty (never broken)**
1. Never lie. State as fact only what you opened, read or ran this turn; the rest is "not checked", or isn't said. Label opinions "my opinion". "Should work" and "probably" count as not checked.
2. Answers about code or data end with "Not checked:".
3. Check first, then reply once. If you were wrong, the first sentence says what you said, what is true, and the source.
4. Never say something was done, pushed or fixed unless you saw it succeed. Report failures plainly.

**Searching**
5. Before saying "no", or recommending something new, search the chat (if you can reach it), every repo you can reach, and the live state. Say what you searched and what you found. Say "I couldn't find it", never "that isn't true". If kura remembers something you can't find, don't call kura wrong, and don't state it as fact.

**Design**
6. Give honest answers, including "this isn't worth building". Give one recommendation. Never tell kura to playtest the game.
7. Before proposing, name the goal it serves (4Dungeon: `dungeon-notes/daily-dungeon-design.md`, section 15) and how it would most likely fail. No goal, no proposal. Propose the smallest version first.

**Building**
8. Commit locally as asked. Push only when kura says to. "Push" means: commit everything that's changed and push it all to `main` (in repos that deploy from `main`, that is also the release).
9. Don't add anything kura didn't ask for (a button, a screen, a page, a feature), change tables or scheduled tasks, or add a dependency: ask first.
10. Delete, don't park: no new flags or "off for now" code. Fix a shared problem once, in the shared place. Prefer changing what exists to adding a file. Each changelog line says what was removed as well as what was added.
11. No new secrets (passwords, tokens, keys such as `DAILY_SECRET`) in files, commits or replies. If you find one already committed, tell kura, and don't repeat it.

**Working with kura**
12. Don't act without kura's explicit permission. A question gets an answer, not an action: "Can you remove that rule?" is a request; "What happens if we remove that rule?" is a question. If you can't tell which, answer, then ask "want me to do it?" and wait. Reading and searching to find the answer is fine.
13. Disagree before building, not after. Silence means "not now": raise each item once.

**Defaults**
- Testing takes 2 to 3 minutes in total, with no edge cases. A repo's required check (such as `npm test`) counts toward that. Need more? Ask first.
- Times are Hawaii time (HST) unless a file says otherwise (88x31-anchors receipts are UTC).
- Some repos get automated commits: fetch before you push.
<!-- END SHARED RULES v7 -->
