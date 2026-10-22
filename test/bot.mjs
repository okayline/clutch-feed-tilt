// A test player for the engine tests: walks the shortest way to the exit, room centre to door to room centre, and
// turns to shoot any enemy that's out and on the view. Plays the way the page does: inputs land between ticks.
import * as C from "../public/engine/corridor.js";

const T = C.TURN;
const angleTo = (R, x, y) => Math.round(C.atan2(y - R.y, x - R.x) * T / (2 * Math.PI));
const diff = (a, b) => ((((a - b) % T) + T + T / 2) % T) - T / 2;

// The row to shoot at: the one nearest the middle of its box where the middle column hits it (corridor.js cell, DMG).
function aimRow(b) {
  const c = Math.round(C.AIM), mid = Math.round((b.top + b.bot) / 2);
  for (let d = 0; d < b.bot - b.top; d++) for (const r of [mid + d, mid - d]) if (r >= 1 && r <= C.AIM_MAX_Y && C.DMG[C.cell(b, c, r)]) return r;
  return Math.min(C.AIM_MAX_Y, mid);
}

export function playBot(cor, { shootWall = 0 } = {}) {
  const R = C.newRun(cor), S = C.S;
  const centre = (i) => { const r = cor.floor.rooms[i]; const any = cor.blocks.flatMap((row, by) => row.map((v, bx) => v === i ? { x: bx * S + S / 2, y: by * S + S / 2 } : null)).find(Boolean); return any; };
  const pts = [];
  for (let k = 0; k < cor.route.length; k++) {
    const c = centre(cor.route[k]);
    if (k) { const p = pts[pts.length - 1]; pts.push({ x: (p.x + c.x) / 2, y: (p.y + c.y) / 2 }); }
    pts.push(c);
  }
  let w = 1;
  while (!R.over) {
    const eye = C.eyeOf(R);
    const target = R.enemies.find((e) => (e.state === "out" || e.state === "stepping") && C.enemyBox(eye, e));
    if (target) {
      C.press(R, 0);
      const d = diff(angleTo(R, target.x, target.y), R.a);
      if (Math.abs(d) > 4) C.turn(R, Math.max(-150, Math.min(150, d)));
      else if (target.state === "out") { const b = C.enemyBox(C.eyeOf(R), target); if (b) C.fire(R, aimRow(b)); }
    } else {
      const p = pts[Math.min(w, pts.length - 1)];
      if (Math.hypot(p.x - R.x, p.y - R.y) < 0.3 && w < pts.length - 1) w++;
      const d = diff(angleTo(R, p.x, p.y), R.a);
      if (d) C.turn(R, Math.max(-300, Math.min(300, d)));
      // wait in the room before the exit until it opens
      const blockedDoor = R.shut && w === pts.length - 2 && Math.hypot(p.x - R.x, p.y - R.y) < 1.5;
      C.press(R, blockedDoor ? 0 : 1);
    }
    if (shootWall && R.tick % shootWall === 3) C.fire(R, 4);
    C.tick(R);
  }
  return R;
}
