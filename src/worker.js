// CLUTCH FEED TILT Worker. The page and its files are static assets; /api/* comes here first.
//
//   GET /api/today  ->  { day, seed }
//     day   today's date in UTC (YYYY-MM-DD), from the server's clock, so a wrong phone clock can't pick another day
//     seed  the first 4 bytes of SHA-256("cft:" + day), as an unsigned number: everyone gets the same corridor

export async function daySeed(day) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("cft:" + day));
  return new DataView(buf).getUint32(0);
}

export const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/today" && request.method === "GET") {
      const day = utcDay();
      return json({ day, seed: await daySeed(day) });
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
