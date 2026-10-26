// USER: save codes and passkeys, kept by the shared Accounts service like the other 88x31 games.
// Laid out like 4Dungeon's USER panel (daily-dungeon index.html accountBox): a panel inside the 3D view (47 columns,
// 17 rows) that scrolls, the title and the message pinned at its top, [BUTTONS] inline. The passkey code (WebAuthn in
// the browser) is copied from scoundrel.exe / aura-farm. No browser popups.

const $ = (id) => document.getElementById(id);

async function api(method, path, data) {
  const r = await fetch("/api/" + path, method === "GET" ? {} : { method, headers: { "content-type": "application/json" }, body: JSON.stringify(data || {}) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "That didn't work. Try again.");
  return d;
}

let onPlayer = () => {};
let open = false, acct = null, newCode = "", msg = "", copied = false, busy = false, onName = () => {};

// The browser speaks WebAuthn in ArrayBuffers; the server speaks base64url.
const pkSupported = () => !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create);
const fromB64 = (s) => { const t = s.replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(t + "===".slice((t.length + 3) % 4)), (c) => c.charCodeAt(0)).buffer; };
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deviceName = () => {
  const u = navigator.userAgent;
  return /iPhone/.test(u) ? "iPhone" : /iPad/.test(u) ? "iPad" : /Android/.test(u) ? "Android" : /Mac/.test(u) ? "Mac" : /Windows/.test(u) ? "Windows PC" : /Linux/.test(u) ? "Linux" : "this device";
};
const pkOops = (e) => new Error(e && e.name === "NotAllowedError" ? "Passkey cancelled (or it timed out)." : e && e.name === "InvalidStateError" ? "This device already has a passkey for you." : (e && e.message) || "The passkey didn't work.");

async function addPasskey() {
  try {
    const o = await api("POST", "passkey", { action: "register_options" });
    const cred = await navigator.credentials.create({ publicKey: {
      ...o, challenge: fromB64(o.challenge), user: { ...o.user, id: fromB64(o.user.id) },
      excludeCredentials: o.excludeCredentials.map((c) => ({ ...c, id: fromB64(c.id) })),
    } });
    await api("POST", "passkey", { action: "register", label: deviceName(), credential: {
      id: cred.id, response: { clientDataJSON: toB64(cred.response.clientDataJSON), attestationObject: toB64(cred.response.attestationObject) },
    } });
  } catch (e) { throw pkOops(e); }
  await refresh();   // (v0.19.1) the account and the CARRY list
  // passkeys only work on 88x31.app addresses: a save code is the backup if that ever changes
  msg = acct.codes.length ? "Passkey added." : "Passkey added. Make a save code too, as a backup.";
}

async function loginPasskey() {
  let d;
  try {
    const o = await api("POST", "passkey", { action: "login_options" });
    const cred = await navigator.credentials.get({ publicKey: { ...o, challenge: fromB64(o.challenge) } });
    d = await api("POST", "passkey", { action: "login", credential: {
      id: cred.id, response: { clientDataJSON: toB64(cred.response.clientDataJSON), authenticatorData: toB64(cred.response.authenticatorData), signature: toB64(cred.response.signature) },
    } });
  } catch (e) { throw pkOops(e); }
  await loggedIn(d.name);
}

async function loggedIn(name) {
  await refresh();   // (v0.19.1) the account and the CARRY list
  msg = `Logged in as ${name || "your player"}.`;
  onPlayer();
}

// ---------- the panel ----------

const monthDay = (t) => new Date(t * 1000).toLocaleDateString([], { month: "short", day: "numeric" });
let pre = null, input = null;
const btn = (t, a) => { const e = document.createElement("span"); e.textContent = `[${t}]`; e.className = "btn"; e.dataset.pact = a; return e; };
const line = (t, cls) => { const d = document.createElement("div"); d.textContent = t || " "; if (cls) d.className = cls; pre.appendChild(d); return d; };
const row = (...parts) => { const d = document.createElement("div"); d.append(...parts); pre.appendChild(d); return d; };

function paint() {
  const box = $("panel");
  box.hidden = !open;
  if (!open) return;
  pre = box.querySelector("pre");
  const top = box.scrollTop, a = acct;
  pre.innerHTML = "";
  const head = document.createElement("div"); head.className = "top"; pre.appendChild(head);
  const t = document.createElement("div"); const x = btn("", "close"); x.textContent = "[ESC] CLOSE"; t.append(" USER" + " ".repeat(29), x); head.appendChild(t);
  const rule = document.createElement("div"); rule.textContent = " " + "-".repeat(45); head.appendChild(rule);
  const m = document.createElement("div"); m.className = "msg g"; m.textContent = msg ? " " + msg : ""; m.hidden = !msg; head.appendChild(m);
  if (!a) { line(" Loading...", "d"); return; }
  if (a.name) row(` You're ${a.name}.  `, btn("REROLL NAME", "name"));
  if (newCode) {
    line(" YOUR NEW SAVE CODE (shown once)", "g");
    line("   " + newCode, "g code");
    line(" Write it down. It can't be shown again.");
    row("   ", btn(copied ? "COPIED" : "COPY", "copycode"), "  ", btn("DOWNLOAD AS A TEXT FILE", "dlcode"));
    row("   ", btn("DONE", "done"));
    line();
  }
  // (v0.19) CARRY: every copy your account holds in any 88x31 game, newest first. The pinned one (else the newest) is the
  // one you carry into the corridor; PIN carries another from your next run.
  if (a.player) {
    const on = copies.find((x) => x.pinned) || copies[0];
    line(` CARRY  ${on ? on.name + " #" + on.copy : "nothing yet"}`.slice(0, 46), on ? "g" : "");
    for (const [i, x] of copies.slice(0, 12).entries()) row(`   ${(x.name + " #" + x.copy).slice(0, 28).padEnd(29)}`, x === on ? "" : btn("PIN", "pin-" + i));
    if (!copies.length) line("   No copies yet. Find one in 4Dungeon, irl-dungeon or 88x31.", "d");
    line();
  }
  line(` SAVE CODES (${a.codes.length})`);
  for (const c of a.codes) row(`   made ${monthDay(c.created_at)}${c.last_used_at ? ", used " + monthDay(c.last_used_at) : ""}  `, btn("FORGET", "fcode-" + c.id));
  if (!a.codes.length) line("   None yet.", "d");
  row("   ", btn("MAKE A SAVE CODE", "code"));
  line();
  line(` PASSKEYS (${a.passkeys.length})`);
  for (const k of a.passkeys) row(`   ${(k.label || "passkey").slice(0, 14)}, ${monthDay(k.created_at)}  `, btn("FORGET", "fpk-" + k.id));
  if (!a.passkeys.length) line("   None yet.", "d");
  if (pkSupported()) row("   ", btn("ADD A PASSKEY", "pk"));
  else line("   This browser can't do passkeys.", "d");
  line();
  line(" LOG IN ON THIS DEVICE");
  input = document.createElement("input"); input.className = "codebox"; input.placeholder = "save code"; input.autocomplete = "off"; input.spellcheck = false; input.maxLength = 40;
  input.setAttribute("aria-label", "Save code");
  input.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") act("enter"); if (e.key === "Escape") close(); };
  row("   ", input);
  row("   ", btn("USE CODE", "enter"));
  if (pkSupported()) row("   ", btn("LOG IN WITH A PASSKEY", "pklogin"));
  line();
  if (a.codes.length || a.passkeys.length) { row(" ", btn("LOG OUT OF THIS BROWSER", "out")); line(); }
  line(a.player ? ` Saved on ${a.devices} device${a.devices === 1 ? "" : "s"}. Works in the other 88x31 games too.` : " Not signed in. Playing without an account is fine.", "d");
  box.scrollTop = top;
}

const say = (t) => { msg = t; const m = $("panel").querySelector(".msg"); if (m) { m.textContent = t ? " " + t : ""; m.hidden = !t; } };
let copies = [];
const refresh = async () => { acct = await api("GET", "account"); onName(acct.name); copies = acct.player ? (await api("GET", "copies")).copies : []; };

async function act(a) {
  if (a === "close") return close();
  if (busy) return;
  busy = true;
  try {
    if (a === "code") { newCode = (await api("POST", "codes", { action: "new" })).code; copied = false; msg = ""; await refresh(); }
    else if (a === "name") { const d = await api("POST", "name", {}); msg = `You're ${d.name} now.`; await refresh(); }
    else if (a === "done") { newCode = ""; copied = false; msg = ""; }
    else if (a === "copycode") {
      try { await navigator.clipboard.writeText(newCode); copied = true; msg = "Copied. Keep it somewhere safe."; }
      catch { msg = "Couldn't copy. Select the code and copy it by hand."; }
    }
    else if (a === "dlcode") return downloadCode();
    else if (a.startsWith("pin-")) { const x = copies[Number(a.slice(4))]; await api("POST", "pin", { itemId: x.itemId, copy: x.copy }); msg = "Pinned. It's carried from your next run."; await refresh(); }
    else if (a.startsWith("fcode-") || a.startsWith("fpk-")) {
      await api("POST", a.startsWith("fcode-") ? "codes" : "passkey", { action: "remove", id: Number(a.split("-")[1]) });
      msg = "Forgotten."; await refresh();
    }
    else if (a === "enter") {
      const c = input ? input.value.trim() : "";
      if (!c) return say("Type your save code first.");
      const d = await api("POST", "load", { code: c }); await loggedIn(d.name);
    }
    else if (a === "out") { await api("POST", "logout", {}); msg = "Signed out."; await refresh(); onPlayer(); }
    else if (a === "pk") { say("Waiting for your fingerprint, face or PIN..."); await addPasskey(); }
    else if (a === "pklogin") { say("Waiting for your passkey..."); await loginPasskey(); }
    paint();
  } catch (e) { say(e.message); }
  finally { busy = false; }
}

// the save code as a little text file, so it can be kept somewhere safe (from scoundrel.exe)
function downloadCode() {
  const who = (acct && acct.name) || "your player";
  const text = [
    "TILT.EXE save code",
    "",
    `  ${newCode}`,
    "",
    `This code logs you in as ${who} on any browser or device, here and in the other 88x31 games.`,
    `On that one: open ${location.origin}, press U (USER), type it under LOG IN ON THIS DEVICE and press USE CODE.`,
    "Keep it private: anyone with this code can log in as you.",
    `Made ${new Date().toISOString().slice(0, 10)}.`,
    "",
  ].join("\r\n");
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = `tilt-exe-save-code${acct && acct.name ? "-" + acct.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : ""}.txt`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    msg = "Save code downloaded. Keep it somewhere safe.";
  } catch { msg = "Couldn't download. Copy it instead."; }
  paint();
}

function close() { open = false; newCode = ""; msg = ""; paint(); }

export const isOpen = () => open;
export const closePlayer = () => close();

export async function openPlayer() {
  open = true; msg = ""; paint();
  try { await refresh(); } catch (e) { msg = e.message; }
  paint();
}

// Wire the panel. `nameChanged(name)` is told whenever the player's name may have changed.
// `playerChanged` (v0.19.1) is called after logging in or out: the page loads that player's day again.
export function setupAccount(nameChanged, playerChanged = () => {}) {
  onName = nameChanged; onPlayer = playerChanged;
  $("panel").addEventListener("click", (ev) => { const s = ev.target.closest("[data-pact]"); if (s) act(s.dataset.pact); });
  addEventListener("keydown", (ev) => { if (open && ev.key === "Escape") { ev.preventDefault(); close(); } });
}
