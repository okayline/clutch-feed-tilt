// Random player names: two words, like the other 88x31 games. The word lists are copied from the master list,
// dungeon-items src/name-words.js (Nov 8, 2026; change them there first). Every player gets one when they're made or
// next seen: nobody is nameless, and they can reroll it any time (POST /api/name). (Nov 8, 2026: replaces the lowercase
// gamer tags like lagspike and tiltproof; players who already have a tag keep it until they reroll.)
const ADJECTIVES = [
  "Quiet", "Sleepy", "Misty", "Golden", "Silver", "Glowing", "Lucky", "Little", "Mellow", "Sunny",
  "Drowsy", "Faint", "Distant", "Midnight", "Neon", "Pixel", "Static", "Chrome", "Analog", "Turbo",
  "Hyper", "Mega", "Blinking", "Spinning", "Glitchy", "Fuzzy", "Cosmic", "Lunar", "Electric", "Velvet",
  "Bubble", "Plastic", "Candy", "Laser", "Retro", "Wired", "Offline", "Lagging", "Secret", "Shiny",
];
const NOUNS = [
  "Modem", "Cursor", "Floppy", "Pager", "Sprite", "Cassette", "Arcade", "Byte", "Beeper", "Satellite",
  "Antenna", "Jukebox", "Robot", "Rocket", "Respawn", "Emoticon", "Cartridge", "Banner", "Marquee", "Joystick",
  "Mixtape", "Webring", "Guestbook", "Keyboard", "Boombox", "Popup", "Inbox", "Desktop", "Bookmark", "Mouse",
  "Icon", "Chip", "Signal", "Radio", "Screen", "Widget", "Cable", "Button", "Gadget", "Console",
];
// names are at most 16 characters, so only the pairs that fit
const PAIRS = ADJECTIVES.flatMap((a) => NOUNS.map((n) => `${a} ${n}`)).filter((s) => s.length <= 16);
function pick(rand) {
  return PAIRS[Math.floor(rand() * PAIRS.length)];
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
