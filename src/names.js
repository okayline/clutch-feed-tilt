// Random player names, lowercase FPS gamer tags like lagspike, mogger99 and tiltproof (ryan, Oct 21: "names like lagspike,
// mogger99 or tiltproof"). Every player gets one when they're made or next seen: nobody is nameless, and they can reroll
// it any time (POST /api/name).
const WORDS = [
  "lagspike", "tiltproof", "mogger", "clutchgod", "feedlord", "nosc0pe", "headglitch", "sweatlord", "campkid", "rushb",
  "pingdiff", "hitreg", "wallbang", "flickshot", "aimlab", "lowfps", "highping", "respawn", "killcam", "deadeye",
  "triggered", "salty", "toxicity", "smurfing", "bottomfrag", "topfrag", "ragequit", "rekt", "gitgud", "mainmenu",
  "sprayhold", "peekaboo", "ninjadefuse", "lastalive", "oneshot", "twitchy", "jitterclick", "noobtube", "campfire", "frags",
];
const rand2 = (rand) => String(10 + Math.floor(rand() * 90));
// names are at most 16 characters
function pick(rand) {
  const w = WORDS[Math.floor(rand() * WORDS.length)];
  return rand() < 0.4 ? w + rand2(rand) : w;
}

// Give this player a random name nobody has, if they have none (or a different one, with reroll). Returns the player
// with its name (unchanged only if every try hit a taken name).
export async function giveName(env, p, { reroll = false, rand = Math.random } = {}) {
  if (!p || (p.name && !reroll)) return p;
  for (let i = 0; i < 40; i++) {
    const name = pick(rand);
    if (name === p.name) continue;
    try {
      const r = await env.DB.prepare(`UPDATE players SET name = ?, name_key = ? WHERE id = ?${reroll ? "" : " AND name IS NULL"}`)
        .bind(name, name.toLowerCase(), p.id).run();
      if (!r.meta.changes) return { ...p, ...(await env.DB.prepare("SELECT name FROM players WHERE id = ?").bind(p.id).first()) };
      return { ...p, name };
    } catch (e) {
      if (!String(e.message).includes("UNIQUE")) throw e;   // taken: try another
    }
  }
  return p;
}
