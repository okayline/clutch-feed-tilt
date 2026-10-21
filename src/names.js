// Random player names, FPS gamer tags like SweatyNoScope (ryan, Oct 21: "fps gamer names"). Every player gets one when
// they're made or next seen: nobody is nameless, and they can reroll it any time (POST /api/name).
const PREFIXES = [
  "Sweaty", "Tilted", "Camping", "Reloading", "Laggy", "Headshot", "NoScope", "Quick", "Silent", "Crispy",
  "Toxic", "Salty", "Smurf", "Ratty", "Turbo", "Rusty", "Hardscope", "Wallhack", "Flashbang", "Fragging",
  "Spawn", "Stealthy", "Rapid", "Ghost", "Lone", "Frosty", "Spicy", "Dank", "Big", "Tiny",
];
const NOUNS = [
  "Sniper", "Camper", "Rusher", "Fragger", "Medic", "Noob", "Ninja", "Wolf", "Viper", "Reaper",
  "Hawk", "Tank", "Cowboy", "Panda", "Goose", "Waffle", "Potato", "Toaster", "Pixel", "Bunny",
  "Gremlin", "Raccoon", "Wizard", "Pickle", "Goblin", "Turtle", "Sheriff", "Pilot", "Bandit", "Yeti",
];
// names are at most 16 characters, so only the pairs that fit
const PAIRS = PREFIXES.flatMap((a) => NOUNS.map((n) => `${a}${n}`)).filter((s) => s.length <= 16);

// Give this player a random name nobody has, if they have none (or a different one, with reroll). Returns the player
// with its name (unchanged only if every try hit a taken name, which won't happen until most of the pairs are used).
export async function giveName(env, p, { reroll = false, rand = Math.random } = {}) {
  if (!p || (p.name && !reroll)) return p;
  for (let i = 0; i < 40; i++) {
    const name = PAIRS[Math.floor(rand() * PAIRS.length)];
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
