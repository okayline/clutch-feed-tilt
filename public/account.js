// ACCOUNT: save codes and passkeys, kept by the shared Accounts service like the other 88x31 games.
// The passkey code (WebAuthn in the browser) is copied from aura-farm public/app.js, which copied scoundrel.exe.
// No browser popups: anything that needs a second thought asks for a second tap.

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function api(method, path, data) {
  const r = await fetch("/api/" + path, method === "GET" ? {} : { method, headers: { "content-type": "application/json" }, body: JSON.stringify(data || {}) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "That didn't work. Try again.");
  return d;
}

let acct = null, newCode = null, note = "", armed = null, busy = false;

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
  acct = await api("GET", "account");
  // passkeys only work on 88x31.app addresses: a save code is the backup if that ever changes
  note = acct.codes.length ? "Passkey saved." : "Passkey saved. Make a save code too, as a backup.";
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
  acct = await api("GET", "account");
  note = `Logged in as ${name || "your player"}. Welcome back.`;
  onName(acct.name);
}

const md = (t) => t ? new Date(t * 1000).toISOString().slice(5, 10).replace("-", "/") : "";

function draw() {
  const a = acct;
  const el = $("account");
  if (!a) { el.innerHTML = `<p class="t">Loading...</p>`; return; }
  if (newCode) {
    el.innerHTML = `<p class="b">YOUR NEW SAVE CODE</p>
      <p class="code g">${esc(newCode)}</p>
      <p class="t">This code logs you in as ${esc(a.name || "your player")} on any browser or device, here and in the other 88x31 games. It's only shown once. Keep it private.</p>
      <div class="controls"><button type="button" data-act="copy">COPY</button><button type="button" data-act="done">DONE</button></div>
      ${note ? `<p class="g">${esc(note)}</p>` : ""}`;
    return;
  }
  let n = 0;
  const ways = [
    ...a.codes.map((c) => ({ kind: "code", id: c.id, text: `SAVE CODE · made ${md(c.created_at)}${c.last_used_at ? " · last used " + md(c.last_used_at) : ""}` })),
    ...a.passkeys.map((k) => ({ kind: "key", id: k.id, text: `PASSKEY ${k.label || ""}${k.created_at ? " · made " + md(k.created_at) : ""}` })),
  ];
  const hasWay = ways.length > 0;
  el.innerHTML = `<p><span class="b">ACCOUNT</span>  <span class="t">${a.player ? "You're " + esc(a.name) + "." : "No player yet."}</span></p>
    <p class="t">A save code or passkey lets you log in as this player anywhere. They work in the other 88x31 games too.</p>
    ${hasWay ? ways.map((w) => `<p class="row"><span>${String(++n).padStart(2)}  ${esc(w.text)}</span>
        <button type="button" class="small" data-act="forget:${w.kind}:${w.id}">${armed === `forget:${w.kind}:${w.id}` ? "SURE? TAP AGAIN" : "FORGET"}</button></p>`).join("")
      : `<p class="d">No save codes or passkeys yet.</p>`}
    <div class="controls">
      <button type="button" data-act="newcode">NEW SAVE CODE</button>
      ${pkSupported() ? `<button type="button" data-act="addkey">ADD PASSKEY</button><button type="button" data-act="loadkey">LOG IN WITH PASSKEY</button>` : ""}
    </div>
    <div class="controls"><input id="codeIn" placeholder="SAVE CODE" autocomplete="off" spellcheck="false" aria-label="Save code">
      <button type="button" data-act="loadcode">LOG IN</button></div>
    ${a.player ? `<div class="controls"><button type="button" data-act="logout">${armed === "logout" ? "SURE? TAP AGAIN" : "LOG OUT"}</button></div>` : ""}
    ${note ? `<p class="g">${esc(note)}</p>` : ""}`;
}

async function run(fn) {
  if (busy) return;
  busy = true; note = ""; draw();
  try { await fn(); } catch (e) { note = e.message; }
  busy = false; draw();
}

async function act(a) {
  if (a !== armed && !(a.startsWith("forget:") || a === "logout")) armed = null;
  if (a === "newcode") return run(async () => { newCode = (await api("POST", "codes", { action: "new" })).code; acct = await api("GET", "account"); onName(acct.name); });
  if (a === "copy") return navigator.clipboard?.writeText(newCode).then(() => { note = "Copied."; draw(); }, () => { note = "Couldn't copy. Select the code and copy it by hand."; draw(); });
  if (a === "done") { newCode = null; note = "Save code made."; return draw(); }
  if (a === "addkey") return run(async () => { await addPasskey(); onName(acct.name); });
  if (a === "loadkey") return run(loginPasskey);
  if (a === "loadcode") {
    const code = $("codeIn")?.value || "";
    return run(async () => { const d = await api("POST", "load", { code }); await loggedIn(d.name); });
  }
  if (a.startsWith("forget:") || a === "logout") {
    if (armed !== a) { armed = a; return draw(); }
    armed = null;
    if (a === "logout") return run(async () => { await api("POST", "logout", {}); acct = await api("GET", "account"); note = "Logged out."; onName(acct.name); });
    const [, kind, id] = a.split(":");
    return run(async () => {
      if (kind === "code") await api("POST", "codes", { action: "remove", id: Number(id) });
      else await api("POST", "passkey", { action: "remove", id: Number(id) });
      acct = await api("GET", "account"); note = kind === "code" ? "Save code forgotten." : "Passkey removed.";
    });
  }
}

let onName = () => {};

// Wire the ACCOUNT button and panel. `nameChanged(name)` is told whenever the player's name may have changed.
export function setupAccount(nameChanged) {
  onName = nameChanged;
  $("account").addEventListener("click", (ev) => { const b = ev.target.closest("button[data-act]"); if (b) act(b.dataset.act); });
  $("account").addEventListener("keydown", (ev) => { if (ev.key === "Enter" && ev.target.id === "codeIn") act("loadcode"); });
  $("accountBtn").addEventListener("click", async () => {
    const el = $("account");
    el.hidden = !el.hidden;
    $("accountBtn").textContent = el.hidden ? "ACCOUNT" : "CLOSE ACCOUNT";
    if (!el.hidden) { newCode = null; note = ""; armed = null; draw(); await run(async () => { acct = await api("GET", "account"); }); }
  });
}
