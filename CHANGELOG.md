# TILT.EXE Changelog

Newest first. Times are Hawaii time (HST).

---

## v0.18.2 — "Light Check"
**Wed Oct 21, 2026 · 7:40 PM HST**

- Sending a run to the shared registry reads only the newest two ledger entries. Removed: reading and re-checking the whole ledger after every run, which got slower with every run (the ledger itself is unchanged).

## v0.18.1 — "Spare Mag"
**Wed Oct 21, 2026 · 7:25 PM HST**

- On a phone, the ammo count is a button: tap [15/17] at the end of the TILT row to reload. Removed: phones having no way to reload before the magazine ran dry.
- A ghost teammate only plays if their run ends now as it was sealed (the same HP, shots and hits). A run sealed earlier the same day, before a rules change, is left out. Removed: those runs playing out differently from what really happened.

---

## v0.18.0 — "Hard Targets"
**Wed Oct 21, 2026 · 5:05 PM HST**

- Enemies have 16 HP, up from 10. Two crown shots (8 each) drop one, or a crown and 2 head shots; 4 head shots, 8 chest shots, 16 leg shots, or 3 hits on a drone's O. Removed: 10 HP, the crown at 5, and kills in 2 or 3 plain head shots.
- The crown is about 1 pixel tall: a shot within 0.04 of the middle of the @'s row, one column wide. Removed: the crown 0.09 rows either side (about 2 pixels).
- A shot goes wide from 2 tiles out, not 5, and twice as wide: 0.4 columns of swing (and under half as many rows) for every tile past 2, up to 10 tiles past it. Removed: every shot inside 5 tiles (most of a room) landing exactly on the crosshair, and 0.2 columns a tile.
- HEADSHOT!! is only for a kill on the crown; a crown hit that doesn't kill says CROWN!, and a kill with a plain head hit is a plain frag. Removed: HEADSHOT!! on any kill that ended with a head hit.
- The corridor melts in off a black screen. After a death, the mouse comes back 1.5 s after the FEED banner is in, not straight away. Removed: the start's title card (T I L T . E X E, the day and the level), and the mouse coming back the moment the banner finished fading in.
- HP, the crown and the scatter change the rules (corridor.js), so a run sealed before this replays differently as a ghost.

---

## v0.17.0 — "Melt"
**Wed Oct 21, 2026 · 4:54 PM HST**

- Dying, after Doom's (p_user.c P_DeathThink): your view sinks to the floor, red, the gun drops away and you turn toward the nearest enemy; a beat lying there; then the view melts down onto F R A G G E D at half speed; FRAGGED holds, fades to black, a beat on black, and the FEED banner fades in over 1.2 s. The mouse comes back only once the banner is in. Removed: the FEED banner straight away when you died, and the mouse let go at once.
- The screen melt (Doom's f_wipe.c, digital): the old picture slides down off the view in strips that each start at their own time and speed up, with a red glitch band at each strip's top edge. It runs when the corridor first shows (off a title card: T I L T . E X E, the day and the level), on Run It Back (off your last frame), when you get out (onto Y O U   G O T   O U T) and when you die. The fight waits while it runs. Removed: the corridor and new runs appearing at once.
- All of it is drawing only (no rule changes; replays and sealed runs are unchanged), and none of it plays with Reduce Motion on.

---

## v0.16.0 — "Gibs"
**Wed Oct 21, 2026 · 4:39 PM HST**

- Gibs: a hit throws chunks of data from the crosshair, one for each point of damage (legs 1, chest or gun 2, head 4, crown 5, a drone's O 6). Each chunk is 2 or 3 cells wide and 1 or 2 tall, glitches like the enemies, flies out, falls and is gone in under a second. None with Reduce Motion on. Removed: hits showing nothing but the feed line.
- A downed enemy is wiped out over 1.2 seconds: it stays full size while a band of glitch sweeps down it from the head, erasing what's above, the rest glitching more and more. Drawing only; the engine still has it down at once. Removed: the body shrinking to % signs in about half a second.
- Reloading is two frames: the gun swings off to the right and down while the empty magazine falls away on its left, then comes halfway back with a full magazine rising beside it. RELOADING blinks above the gun. Removed: no sign of a reload on the gun.
- The crown is about 2 pixels tall (within 0.09 of the middle of the @'s row), one column wide. Removed: the crown 0.17 rows either side (about 4 pixels).
- The crown change is a rules change (corridor.js `CROWN_ROW`), so a run sealed before this replays differently as a ghost. The rest is drawing only.

---

## v0.15.1 — "Crown Box"
**Wed Oct 21, 2026 · 4:27 PM HST**

- The crown is a little box in the middle of the head's middle `@`: one column wide and a third of a row tall (within 0.17 of the row's middle), about 4 pixels on a full-size screen. Removed: the crown being the middle half of its row (within 0.25).
- This changes the rules (corridor.js `CROWN_ROW`), so a run sealed before this replays differently as a ghost.

---

## v0.15.0 — "Magazine"
**Wed Oct 21, 2026 · 4:14 PM HST**

- You have a Glock 17's magazine: 17 rounds, shown at the end of the TILT row (`17/17`, yellow at 3 or fewer, red `RELOAD` while reloading). R reloads: 1.5 seconds with no shot possible, then a full magazine; the rounds left in the old one are dropped. An empty magazine reloads by itself. A click while reloading does nothing and isn't a shot. Removed: unlimited shots.
- The crown does 5 damage, half an enemy's 10 HP. Two crown shots drop an enemy, as do 3 non-crown head shots or 2 chest and 2 head; 5 chest shots do too. Removed: the crown dropping an enemy at once.
- A reload is a new input, [tick, 3, 0], in the run's log. A run that shoots during a reload, or reloads with a full magazine, doesn't replay.
- These change the rules (corridor.js: the magazine, reloading, the crown's damage), so a run sealed before this replays differently as a ghost, and one that fired more than 17 shots without a reload is left out of the ghosts.

---

## v0.14.0 — "No Fog"
**Wed Oct 21, 2026 · 4:06 PM HST**

- No fog: you see all the way down a corridor, walls, floor, ceiling and enemies alike. Removed: the 9-tile sight limit and the darkness past it.
- You start in the first room of the first wing whose middle can't see the exit, so the exit is never in sight from where you start. Removed: always starting in the first wing's first room, which could look straight down a line of doors to the exit. (About 1 day in 26 still can, when no room in the wing is clear.)
- Enemies have 10 HP, up from 6: the chest or gun takes 5 hits, the head 3, the legs 10, and a drone's O 2. The crown still drops one at once. Removed: 6 HP, where a chest took 3 hits and a drone's O one.
- The crown is the dead centre of the middle @: a shot within a quarter row of its middle. Removed: the crown being the whole of the head's top row.
- A far shot goes wide, and nothing on the screen shakes to show it: an enemy on the view past 5 tiles adds 0.2 columns of swing (and under half as many rows) for every tile further, up to 10 tiles past 5, so a far shot has to be timed. Removed: every shot landing exactly on the crosshair at any range when you aren't tilting.
- A drone fires every 50 ticks, others every 25. Removed: the drone firing as fast as the rest.
- These change the rules (corridor.js: where you start, enemy HP, the crown, shot scatter, the drone's fire rate), so a run sealed before this replays differently as a ghost.

---

## v0.13.0 — "Two Wings"
**Wed Oct 21, 2026 · 3:50 PM HST**

- The run is only the day's two wings: those rooms are built and every door out of them into another wing's room is wall, in the 3D view and on the minimap. Today that's 7 rooms instead of 18. Removed: every wing 4Dungeon's players have opened being built and walkable, which made the run a long maze.
- The three enemies that don't guard the exit wait in the rooms on the way to it, one a room, then in the run's other rooms if the way is short. Removed: them being dealt to any room of the two wings, off the way as often as on it.
- You start facing the next room on the way. Removed: always starting facing north, which can now be a wall.
- You see about 9 tiles, a room and into the next; past that is dark, walls, floor, ceiling and enemies alike. The end of the run stays out of sight until you're near it. Removed: seeing down a straight run all the way to the exit from the start.
- The shut exit is a holo gate in the middle of its 3 tiles: a bright | post each side and a field of : ' . falling between them, in a plain wall. Removed: the exit's gold # on all 3 tiles, and gold on any wall.
- These change the rules (corridor.js: the rooms built, where enemies wait, the way you start facing), so a run sealed today before this replays differently as a ghost.

---

## v0.12.3 — "High Ceilings"
**Wed Oct 21, 2026 · 3:38 PM HST**

- Walls in the 3D view are twice as high: they stand on the same floor as the enemies and rise above you, with their own \ and / top edge. Above them is a ceiling, drawn as dotted lines running the way you face, like the floor's. Only the drawing changed; shots are checked as before. Removed: walls only as high as from the floor to your eye and back, and the empty space above them.

---

## v0.12.2 — "Side Walls"
**Wed Oct 21, 2026 · 3:25 PM HST**

- A wall in the 3D view is drawn as one stretch from corner to corner: the blocks side by side along one wall share one \ and / edge, and an upright | stands only at a real corner (where one stretch meets another, or ends in front of one further away), on the nearer of the two and all the way up it. Side walls now read as walls running away from you, as 4Dungeon's do. A side wall's top and bottom edges are unbroken \ and / lines. A wall facing you has an upright | at the edge of every block in it, so a solid wall reads as one. Removed: the | between every block of a side wall, which made side walls a fence of bars; the gaps in a side wall's sloping edges; and the field of dots on a wall facing you.
- The gun is solid: the gaps inside it hide the wall or door behind it, so a # door no longer shows through it. Removed: the see-through gaps in the gun.

---

## v0.12.1 — "Outlines"
**Wed Oct 21, 2026 · 2:55 PM HST**

- Walls in the 3D view are drawn in outline, the way 4Dungeon draws its own: a wall's top and bottom edges are \ and / where they run away from you, every block's corner is an upright |, and a wall facing you is a field of dots. Locked doors stay filled with #, and the gold exit is now gold # too. Removed: walls filled with shaded characters, the _ lines along their tops and bottoms, the = - fill on far walls, and the exit's = fill, so no wall has horizontal lines.

## v0.12 — "As Far As They've Gone"
**Wed Oct 21, 2026 · 2:50 PM HST**

- The floor is open as far as 4Dungeon's players have opened it this quarter, read once when the day starts and kept on the day's ledger entry. Today's two wings are the last two of those, and the exit is the door into the next one. Removed: every wing of the floor open every day.
- A sealed door (the other door of a pair that was opened) is plain wall, as on the minimap. Removed: sealed doors drawn as locked # doors.

## v0.11.1 — "Drones"
**Wed Oct 21, 2026 · 2:40 PM HST**

- A shot hits only what's drawn: the gap between an enemy's legs and the space beside its head miss. Removed: the box round each enemy, with a spare cell all round it, that any shot inside hit.
- Where you hit matters. The middle of the top of the head drops an enemy in one shot. The rest of the head then a body shot is a double tap. Three chest shots drop it, and a leg shot does half a chest shot ("YOU tagged ENEMY in the leg"). Removed: every body shot doing the same, legs included.
- Three kinds of enemy, in turn: short and fat, tall and skinny with its gun on the left, and a small drone hovering at head height with spinning rotors. Only the drone's middle O can be hit, and one hit drops it. Removed: one size of enemy for everyone.
- Enemies glitch: a few of their characters keep scrambling into 4Dungeon's glyphs, the drone's a little less. It's only how they look, and a shot still hits the real shape. Removed: enemies drawn plain.

## v0.11 — "Free Roam"
**Wed Oct 21, 2026 · 2:30 PM HST**

- You walk anywhere on the floor: W A S D to walk and strafe, and walls stop you. You start facing north (up on the minimap). Removed: the rails, and the stops and turns on the spot along them.
- Walls are drawn in perspective: each column of a wall is as tall as the wall is near along it, so a wall running beside you narrows away into the distance, one upright panel behind another. Every block's edge is drawn as a | however far away it is. Removed: every wall panel drawn flat at the height of its middle, which made walls beside you flat horizontal bands, and block edges only within 9 tiles.
- The whole 4Dungeon floor is built, so there's a door in the 3D view wherever the minimap shows one, and a locked door (# on the minimap) is a # door you can't open. The enemies and the exit stay in the day's two wings. Removed: walls in the 3D view where the minimap shows a door to another wing.
- Click the 3D view to take the mouse; moving it left and right turns you, up and down moves the crosshair. The crosshair stays in the middle and a click shoots there. Esc lets the mouse go. Removed: aiming by moving the crosshair over the view.
- On a phone: put a thumb down on the left half of the view and drag to walk; drag on the right half to turn and aim, and tap there to shoot. Removed: tapping where you want to shoot.
- 5 enemies, all yours to shoot, wait in notches in the walls of the rooms. One steps out when it can see you, and it only shoots while it can. Removed: 3 enemies that woke by how far along the rails you were and hit you through walls, and your squad taking 2 of 5.
- The run ends when you walk through the exit, the door into the next wing (or the stairs). It's a gold door, shut until the two enemies guarding it are down. Three minutes and you didn't get out is a FEED. Removed: the run ending with the last enemy, and the ten minute limit.
- Your squad is ghosts: up to 3 other players' sealed runs today walk beside you, and the kill feed says what they did as it happens. Removed: the made-up teammates and BOT_FEEDER, their scripted kill feed, and the 1v3 LAST MAN STANDING banner.
- A miss counts as one with an enemy on the view only if the enemy isn't behind a wall. Removed: an enemy behind a wall counting.

## v0.10.1 — "TILT.EXE"
**Wed Oct 21, 2026 · 2:25 PM HST**

- The game is called TILT.EXE: the page title, the name at the top of the screen and the save code file (now `tilt-exe-save-code.txt`). Removed: the name CLUTCH FEED TILT. Your runs are still called CLUTCH, FEED or TILT, and your save codes, runs and ledger are unchanged.

## v0.10 — "Double Tap"
**Wed Oct 21, 2026 · 1:50 PM HST**

- An enemy takes 3 body shots to drop. A shot on its head (the @) counts as 2, so a double tap (a body shot and a headshot) drops it; a headshot alone doesn't. The feed says YOU tagged ENEMY, YOU nailed ENEMY in the head, YOU fragged ENEMY or HEADSHOT!! YOU fragged ENEMY. Removed: every hit killing.
- HITS now counts every shot that lands, body shots included. Removed: the "enemies still up" line on an already sealed FEED run (the sealed run doesn't keep kills).
- A miss while an enemy is on screen adds more tilt and always leaves the TILT bar at least 3 of 5; a shot at nothing adds only a quarter. Removed: every miss adding the same 1.
- A headshot is only the @ itself. Far away, where the head is a row or two, that's a hard shot. Removed: the spare row above the head counting as head.
- The kill feed, banners and status line talk like a 90s shooter (fragged, tagged, nailed, gibbed, LAST MAN STANDING, CLICK TO FRAG). A miss with an enemy on screen says YOU whiffed. Removed: the old wording, and the last kill line staying up after misses (it looked like every headshot was a kill).
- The mouse pointer is hidden over the 3D view, so only the game's crosshair shows. Removed: the desktop crosshair cursor on top of it.
- The K column next to your name shows your kills. Removed: it showing hits.

## v0.9.5 — "Plus Corners"
**Wed Oct 21, 2026 · 1:10 PM HST**

- Every corner of a room on the minimap is a +, even next to a door. Removed: the - and | that 4Dungeon's minimap code draws on a corner beside a door.

## v0.9.4 — "Not Turned"
**Wed Oct 21, 2026 · 1:09 PM HST**

- The minimap is drawn exactly as 4Dungeon would draw this floor, not turned: you see the route spread along the wide side of the map, with its corners. The arrow starts pointing whichever way the route goes. Removed: v0.8.1's turn that made the first stretch point up, which squeezed the route into a short column.

## v0.9.3 — "Told on the Registry"
**Wed Oct 21, 2026 · 1:08 PM HST**

- The checkpoint each sealed run sends to the registry now carries the run's day, label, HP, hits and shots, so the registry's ledger page tells it as a sentence ("A CLUTCH run. 3 hits from 5 shots, 2 HP left.") in CLUTCH FEED TILT's own frame. No player and no shot log go with it. Removed: the plain "sealed its ledger here" line for this game.

## v0.9.2 — "Same Minimap"
**Wed Oct 21, 2026 · 1:07 PM HST**

- The minimap is 4Dungeon's, drawn from the floor exactly as it is: every door is a gap and a locked one is #, so the corners and walls come out the way they do in 4Dungeon. Checked against 4Dungeon's own code on 20,400 map positions with no difference. Removed: v0.8.2's change that drew a wall wherever the 3D view has one.

## v0.9.1 — "In-game Ledger"
**Wed Oct 21, 2026 · 1:04 PM HST**

- [L]EDGER (or the L key) opens this game's own ledger in a panel inside the game, like USER: every sealed day and run, newest first, with its number, what it says (the day's level and wing, or the run's label, hits out of shots and HP) and the start of its hash. [SHOW OLDER] loads more. The run waits while it's open. Removed: the [L]EDGER link that opened the registry's page in a new tab.

## v0.9 — "Ledger"
**Wed Oct 21, 2026 · 1:00 PM HST**

- Every sealed run now sends a checkpoint to the shared registry, so CLUTCH FEED TILT's ledger is on the registry's public ledger page and under its hourly Bitcoin stamp. If the registry is away, the run is still sealed. Removed: nothing; before, this ledger was only on this game's own server.
- A [L]EDGER button (or the L key) opens that page in a new tab.
- The 3-misses message says "you're tilted". Removed: "you're tilting...".

## v0.8.2 — "Walls"
**Wed Oct 21, 2026 · 12:55 PM HST**

- The minimap draws a wall wherever the 3D view has one: a door to a room that isn't in today's corridor is wall now. It still shows only the rooms you've been through, like 4Dungeon's. Removed: gaps in the minimap's walls that led nowhere.

## v0.8.1 — "Up"
**Wed Oct 21, 2026 · 12:47 PM HST**

- The minimap is turned so the run always starts out going up: your arrow points up in the first room. Removed: the map's fixed north, which could start you pointing down, left or right.

## v0.8 — "Shorter"
**Wed Oct 21, 2026 · 12:47 PM HST**

- The corridor is about a third shorter: it runs through two wings of the floor, ending with the day's own, so 3 to 5 rooms instead of 4 to 7. Removed: the third wing.

## v0.7 — "Replay"
**Wed Oct 21, 2026 · 12:22 PM HST**

- The server plays your run again before sealing it. The page sends only your shots and when you fired them; the server replays today's corridor with those shots and seals the result it gets. Removed: sealing the HP, hits and shots the page reported.
- The fight runs in fixed steps, 15 a second, the same on every device. While you're tilting, the crosshair shakes in a zig-zag of the same width. Removed: the shake's sine waves, and timers that ran on frame time.

## v0.6 — "B3F"
**Wed Oct 21, 2026 · 9:20 AM HST**

- Each day's corridor runs through the real 4Dungeon floor of that moon quarter: three of its wings, ending with the day's own. The top of the screen says which, e.g. 4DUNGEON B3F WING 4. Removed: maps of made-up wings.
- The ledger makes the map. The first visit of each day seals that day on the ledger, and the seal picks which doors open. Nobody can know the day's corridor before the day starts. Removed: a seed worked out from the date alone.

## v0.5.10 — "Steadier"
**Wed Oct 21, 2026 · 9:12 AM HST**

- The crosshair shakes half as far while you're tilting. Removed: the wider shake.

## v0.5.9 — "Run It Back"
**Wed Oct 21, 2026 · 9:12 AM HST**

- Once your run is over, [R]UN IT BACK (or the R key) plays today's corridor again as practice. Practice runs aren't sealed, and your sealed run stays as it was. Removed: nothing.

## v0.5.8 — "Quiet"
**Wed Oct 21, 2026 · 9:07 AM HST**

- Nothing under the game now. Removed: the two lines of explanation below the screen.

## v0.5.7 — "Cool Down"
**Wed Oct 21, 2026 · 9:05 AM HST**

- A hit takes your tilt down by half, and a second hit in a row takes it to nothing. Removed: one hit clearing all your tilt.

## v0.5.6 — "Slow Pan"
**Wed Oct 21, 2026 · 9:04 AM HST**

- Turns take 2.4 seconds. Removed: the quick 0.8 second turn.

## v0.5.5 — "Every Shot"
**Wed Oct 21, 2026 · 9:03 AM HST**

- Every shot counts, even while you're walking with nothing to shoot at. It's a miss, it lowers your accuracy and it shakes your crosshair, so firing at random can make your run a TILT. Removed: free shots before the enemies step out.

## v0.5.4 — "Pan"
**Wed Oct 21, 2026 · 9:02 AM HST**

- You stop in the middle of a room to turn, and turn on the spot. While you turn, the walls just slide sideways. Removed: turning while walking through the room.
- Each wall block's face is one flat panel with a line down its edge. Removed: walls that sloped inside a block, and lines placed by where a ray hit.

## v0.5.3 — "Fifteen"
**Wed Oct 21, 2026 · 8:58 AM HST**

- The game runs at 15 frames a second. Removed: drawing at your screen's full refresh rate.
- Each block of wall keeps its own character while you turn. Removed: wall shading that slid across the walls as you looked around.

## v0.5.2 — "Stutter"
**Wed Oct 21, 2026 · 8:51 AM HST**

- Turns jump round in six steps, like an old game at a low frame rate. Removed: the smooth turn.

## v0.5.1 — "Rib Lines"
**Wed Oct 21, 2026 · 8:49 AM HST**

- Lines run along the top of the gun's slide, from the rear sight toward the front sight. Removed: the plain, empty top of the slide.

## v0.5 — "Wings"
**Wed Oct 21, 2026 · 8:46 AM HST**

- The corridor is now a map of rooms from 4Dungeon's wing generator, the same for everyone each day. You still run on rails, and they turn with the rooms. Enemies wait in notches in the walls, and a minimap shows the rooms you've passed. Removed: the one straight corridor and its alcoves.

## v0.4.4 — "Sight Line"
**Wed Oct 21, 2026 · 8:47 AM HST**

- You see the Glock from a little above now: the top of the slide narrows away from you to the front sight, with the rear sight across its back edge. Removed: the front sight sitting flat in the rear sight's notch.

## v0.4.3 — "Cover Plate"
**Wed Oct 21, 2026 · 8:35 AM HST**

- The Glock is bigger and more detailed: white dots on the rear sight, the slide's top edge, the cover plate on its back, the frame and the textured grip. It moves up and down less: one row when it's far out to the side, one row when it fires. Removed: the smaller gun and its two-row dip.

## v0.4.2 — "Glock"
**Wed Oct 21, 2026 · 8:33 AM HST**

- A new gun drawn from a real pistol (a Glock 17 from behind: sights, slide, frame, grip) with straight sides. It moves as one stiff piece. Removed: the old flared gun and the way it bent as it swung.

## v0.4.1 — "Swing"
**Wed Oct 21, 2026 · 8:24 AM HST**

- The gun stays at the bottom middle and swings toward your crosshair in a small arc, dipping as it swings out. Removed: the gun sliding all the way across the screen.

## v0.4 — "Sealed"
**Wed Oct 21, 2026 · 8:11 AM HST**

- One run a day, sealed on a hash-chain ledger the moment it ends. Come back the same day and you see your sealed run; a new corridor opens at midnight UTC. Removed: the RUN IT BACK button and unlimited unsaved runs.

## v0.3.8 — "Over the Gun"
**Wed Oct 21, 2026 · 8:02 AM HST**

- The crosshair stays above the gun. Removed: the crosshair sliding down behind it.

## v0.3.7 — "Big Gun"
**Wed Oct 21, 2026 · 8:00 AM HST**

- The gun is bigger, sits at the bottom and slides left and right after your crosshair. The floor lines that scrolled toward you are gone. Removed: the small fixed gun and the scrolling cross lines.

## v0.3.6 — "Boxed In"
**Wed Oct 21, 2026 · 7:55 AM HST**

- Message boxes (1 v 3, CLUTCH, TILT, FEED) have a right edge now and their text sits in the middle. Removed: the open right side and the extra-wide box.

## v0.3.5 — "Log Lines"
**Wed Oct 21, 2026 · 7:52 AM HST**

- The bottom of the screen is laid out like 4Dungeon's, with three log lines. You can tap anywhere on a message to close it, and the crosshair stops going wild and now moves under a message box too. Removed: the kill feed panel.

## v0.3.4 — "Aim Up"
**Wed Oct 21, 2026 · 7:45 AM HST**

- The crosshair follows you up and down now, and shots have to land on the enemy. Removed: the crosshair stuck on one line.

## v0.3.3 — "Trigger Happy"
**Wed Oct 21, 2026 · 7:43 AM HST**

- You can shoot from the start of the run. Removed: the first few seconds where clicks did nothing.

## v0.3.2 — "Click Away"
**Wed Oct 21, 2026 · 7:42 AM HST**

- Tap a message box to close it. Removed: the end-of-run box staying in the way.

## v0.3.1 — "Same Size"
**Wed Oct 21, 2026 · 7:38 AM HST**

- The game is the same size as 4Dungeon's now, and names are lowercase gamer tags. Removed: the oversized window and the old names.

## v0.3 — "Gamer Tags"
**Wed Oct 21, 2026 · 7:35 AM HST**

- Gamer-tag names, and a button to reroll yours. Removed: the two-word names.

## v0.2.1 — "Version Tag"
**Wed Oct 21, 2026 · 7:33 AM HST**

- The version number sits under the screen. Removed: the version line at the bottom of the page.

## v0.2 — "Log In"
**Wed Oct 21, 2026 · 7:32 AM HST**

- Log in with a save code or passkey, the same ones as the other 88x31 games (press U). The game sits in the middle of the window. Removed: the text glow.

## v0.1 — "1v3"
**Wed Oct 21, 2026 · 7:16 AM HST**

- First version: one corridor a day, the same for everyone. Your squad falls, then it's you against 3. Removed: nothing (first version).
