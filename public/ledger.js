// LEDGER: this game's own ledger, newest first, in a panel inside the 3D view like USER's (same size, scrolls, title
// pinned at its top). Every sealed day and run: its number, what it says and the start of its hash. No browser popups.

const $ = (id) => document.getElementById(id);
const PAGE = 30;

let open = false, entries = [], more = false, msg = "Loading...", busy = false;

// one entry in words: a day (its level and wing) or a run (its label, hits out of shots, HP left)
function words(e) {
  const r = JSON.parse(e.record), d = e.day.slice(5);
  return e.kind === "day" ? `DAY ${d}  ${r.level} WING ${r.wing}` : `RUN ${d}  ${r.label}  ${r.hits}/${r.shots}  HP ${r.hp}`;
}

function paint() {
  const box = $("ledgerPanel");
  box.hidden = !open;
  if (!open) return;
  const pre = box.querySelector("pre"), top = box.scrollTop;
  pre.innerHTML = "";
  const line = (t, cls) => { const d = document.createElement("div"); d.textContent = t || " "; if (cls) d.className = cls; pre.appendChild(d); return d; };
  const head = document.createElement("div"); head.className = "top"; pre.appendChild(head);
  const t = document.createElement("div"), x = document.createElement("span");
  x.className = "btn"; x.dataset.lact = "close"; x.textContent = "[ESC] CLOSE";
  t.append(" LEDGER" + " ".repeat(27), x); head.appendChild(t);
  const rule = document.createElement("div"); rule.textContent = " " + "-".repeat(45); head.appendChild(rule);
  if (msg) line(" " + msg, "d");
  for (const e of entries) {
    line(` #${e.id}  ${words(e)}`);
    line("     " + e.hash.slice(0, 16), "d");
  }
  if (more) {
    const d = document.createElement("div"), b = document.createElement("span");
    b.className = "btn"; b.dataset.lact = "more"; b.textContent = "[SHOW OLDER]";
    d.append(" ", b); pre.appendChild(d);
  }
  box.scrollTop = top;
}

async function load() {
  if (busy) return;
  busy = true;
  try {
    const before = entries.length ? entries[entries.length - 1].id : "";
    const r = await fetch(`/api/ledger?limit=${PAGE}${before ? "&before=" + before : ""}`);
    if (!r.ok) throw new Error(r.status);
    const got = (await r.json()).entries;
    entries = entries.concat(got); more = got.length === PAGE;
    msg = entries.length ? "" : "Nothing sealed yet.";
  } catch { msg = "Couldn't load the ledger. Close and open it again."; }
  finally { busy = false; }
  paint();
}

export const isOpen = () => open;
export const closeLedger = () => { open = false; paint(); };
export function openLedger() { open = true; entries = []; more = false; msg = "Loading..."; paint(); load(); }

export function setupLedger() {
  $("ledgerPanel").addEventListener("click", (ev) => {
    const s = ev.target.closest("[data-lact]");
    if (!s) return;
    if (s.dataset.lact === "close") closeLedger(); else if (s.dataset.lact === "more") load();
  });
  addEventListener("keydown", (ev) => { if (open && ev.key === "Escape") { ev.preventDefault(); closeLedger(); } });
}
