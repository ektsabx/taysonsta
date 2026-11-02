/* Yolias Pixel Helper — background worker.
   Keeps, for each tab, the pixels found and the events they sent, checks each
   pixel id with the Yolias server, finds problems like Facebook's Pixel Helper
   does, and shows the number of events on the toolbar icon. */
const STANDARD = ["PageView", "ViewContent", "Search", "AddToCart", "AddToWishlist", "InitiateCheckout", "AddPaymentInfo", "Purchase", "CustomizeProduct", "StartTrial", "Subscribe", "Donate", "Lead", "CompleteRegistration", "Contact", "SubmitApplication", "Schedule", "FindLocation"];
const VALUE_REQUIRED = ["Purchase"];
const key = (tabId) => `tab:${tabId}`;
const empty = (url) => ({ url, pixels: {}, events: [], base: { scripts: [], inline: false }, origin: null });

async function load(tabId) { const r = await chrome.storage.session.get(key(tabId)); return r[key(tabId)] || null; }
async function save(tabId, st) { await chrome.storage.session.set({ [key(tabId)]: st }); }

async function checkPixel(origin, id) {
  try {
    const r = await fetch(`${origin || "https://www.yolias.com"}/api/px?check=${encodeURIComponent(id)}`, { cache: "no-store" });
    const j = await r.json();
    return j && j.ok ? { valid: true, name: j.name || "" } : { valid: false };
  } catch (e) { return { valid: null }; }
}

/** Problems with one event, like Facebook's Pixel Helper warnings. */
function problems(ev, seen) {
  const out = [];
  if (ev.error === "no_init") out.push({ level: "error", code: "no_init" });
  if (ev.event && !STANDARD.includes(ev.event) && !ev.custom) out.push({ level: "warn", code: "unknown_event" });
  const p = ev.params || {};
  if (VALUE_REQUIRED.includes(ev.event)) {
    if (p.value == null || p.value === "") out.push({ level: "warn", code: "missing_value" });
    else if (isNaN(Number(p.value))) out.push({ level: "error", code: "bad_value" });
    if (!p.currency) out.push({ level: "warn", code: "missing_currency" });
    else if (!/^[A-Za-z]{3}$/.test(String(p.currency))) out.push({ level: "error", code: "bad_currency" });
  }
  if (p.event_id && seen.has(`${ev.pixel}:${ev.event}:${p.event_id}`)) out.push({ level: "warn", code: "duplicate_event_id" });
  return out;
}

async function badge(tabId, st) {
  const n = st.events.filter((e) => e.event).length;
  const bad = st.events.some((e) => e.problems.some((x) => x.level === "error")) || Object.values(st.pixels).some((p) => p.valid === false);
  await chrome.action.setBadgeText({ tabId, text: n ? String(Math.min(n, 99)) : Object.keys(st.pixels).length ? "✓" : "" });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: bad ? "#cf2525" : "#16a34a" });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender.tab && sender.tab.id;
  if (tabId == null) return;
  (async () => {
    let st = (await load(tabId)) || empty(msg.url);
    if (st.url !== msg.url && msg.type === "scan" && !st.events.length) st = empty(msg.url);
    if (msg.type === "scan") {
      st.url = msg.url;
      st.base = { scripts: msg.scripts, inline: msg.inline };
      for (const id of msg.ids) if (!st.pixels[id]) st.pixels[id] = { id, valid: null, name: "" };
    } else if (msg.type === "event") {
      const d = msg.detail;
      if (d.origin) st.origin = d.origin;
      if (d.type === "init") {
        st.pixels[d.pixel] = st.pixels[d.pixel] || { id: d.pixel, valid: null, name: "" };
        st.pixels[d.pixel].matching = d.matching;
      } else {
        const seen = new Set(st.events.filter((e) => e.params && e.params.event_id).map((e) => `${e.pixel}:${e.event}:${e.params.event_id}`));
        st.events.push({ ...d, problems: problems(d, seen) });
        if (st.events.length > 200) st.events.shift();
      }
    }
    for (const id of Object.keys(st.pixels)) {
      if (st.pixels[id].valid === null && !st.pixels[id].checking) {
        st.pixels[id].checking = true;
        const r = await checkPixel(st.origin, id);
        st.pixels[id] = { ...st.pixels[id], ...r, checking: false };
      }
    }
    await save(tabId, st);
    await badge(tabId, st);
  })();
});

// A new page in the tab starts a new list.
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "loading" && info.url) { void save(tabId, empty(info.url)); void chrome.action.setBadgeText({ tabId, text: "" }); }
});
chrome.tabs.onRemoved.addListener((tabId) => { void chrome.storage.session.remove(key(tabId)); });
