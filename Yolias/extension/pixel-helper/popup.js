/* Yolias Pixel Helper — popup: the pixels on this page and every event they sent, with problems, like Facebook's Pixel Helper. */
const AR = (navigator.language || "").toLowerCase().startsWith("ar");
const T = AR ? {
  none: "لم يُعثر على بيكسل يولياس في هذه الصفحة", noneLine: "إذا كان موقعك يحتوي على البيكسل، أعد تحميل الصفحة. الأحداث تظهر هنا فور إرسالها.",
  pixel: "بيكسل", valid: "معرّف صحيح", invalid: "لم يُعثر على هذا المعرّف في يولياس", checking: "جارٍ التحقق…", offline: "تعذّر التحقق الآن",
  events: "حدث", noEvents: "لم يُرسل هذا البيكسل أي حدث بعد.", baseOnly: "الكود الأساسي موجود لكن لم يُستدعَ init.", custom: "حدث مخصص",
  params: "المعاملات", fromYolias: "من رابط يولياس", matched: "مطابقة البريد", test: "اختبار", url: "الصفحة", yes: "نعم", no: "لا", open: "افتح مدير الأحداث",
  p: { no_init: "أُرسل الحدث قبل init: لن يصل إلى أي بيكسل.", unknown_event: "ليس حدثًا قياسيًا. استخدم trackCustom للأحداث المخصصة.", missing_value: "حدث الشراء بدون value: لن تُحسب قيمة المبيعات.", bad_value: "value ليس رقمًا.", missing_currency: "حدث الشراء بدون currency.", bad_currency: "currency يجب أن يكون رمزًا من 3 أحرف مثل USD.", duplicate_event_id: "نفس event_id أُرسل من قبل: سيُحسب مرة واحدة." },
} : {
  none: "No Yolias pixel found on this page", noneLine: "If your site has the pixel, reload the page. Events show here as soon as they are sent.",
  pixel: "Pixel", valid: "Valid ID", invalid: "This ID wasn't found in Yolias", checking: "Checking…", offline: "Couldn't check right now",
  events: "events", noEvents: "This pixel hasn't sent any event yet.", baseOnly: "The base code is here but init wasn't called.", custom: "Custom event",
  params: "Parameters", fromYolias: "From a Yolias link", matched: "Email matching", test: "Test", url: "Page", yes: "Yes", no: "No", open: "Open Events Manager",
  p: { no_init: "Sent before init: it reaches no pixel.", unknown_event: "Not a standard event. Use trackCustom for custom events.", missing_value: "Purchase without value: purchase value won't be counted.", bad_value: "value isn't a number.", missing_currency: "Purchase without currency.", bad_currency: "currency must be a 3-letter code like USD.", duplicate_event_id: "This event_id was sent before: it counts once." },
};
document.documentElement.dir = AR ? "rtl" : "ltr";
document.getElementById("em").textContent = T.open;
const el = (tag, cls, text) => { const x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; };
const time = (ms) => new Date(ms).toLocaleTimeString(AR ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });

chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
  const app = document.getElementById("app");
  const st = tab ? (await chrome.storage.session.get(`tab:${tab.id}`))[`tab:${tab.id}`] : null;
  if (st && st.origin) document.getElementById("em").href = `${st.origin}/events`;
  const ids = st ? [...new Set([...Object.keys(st.pixels), ...st.events.map((e) => e.pixel).filter(Boolean)])] : [];
  if (!st || (!ids.length && !st.events.length && !st.base.scripts.length && !st.base.inline)) {
    const box = el("div", "empty"); box.append(el("strong", null, T.none), el("span", null, T.noneLine)); app.append(box); return;
  }
  if (!ids.length) { const m = el("div", "pixel"); m.append(el("div", "msg err", T.baseOnly)); app.append(m); }
  for (const id of ids) {
    const px = st.pixels[id] || { id, valid: null };
    const evs = st.events.filter((e) => e.pixel === id);
    const card = el("section", "pixel");
    const head = el("div", "pixel-head");
    head.append(el("span", `dot ${px.valid === true ? "ok" : px.valid === false ? "bad" : ""}`), el("span", "id", `${T.pixel} ${id}`), el("span", "name", px.valid === true ? (px.name || T.valid) : px.valid === false ? T.invalid : px.checking ? T.checking : T.offline));
    card.append(head);
    if (px.valid === false) card.append(el("div", "msg err", T.invalid));
    card.append(el("div", "msg", `${evs.length} ${T.events}`));
    if (!evs.length) card.append(el("div", "msg warn", T.noEvents));
    for (const e of evs.slice().reverse()) {
      const worst = e.problems.some((x) => x.level === "error") ? "err" : e.problems.length ? "warn" : "ok";
      const row = el("div", "ev");
      const btn = el("button");
      btn.append(el("span", `icon ${worst}`, worst === "ok" ? "✓" : "!"), el("span", "name", e.event), el("span", "tag", `${e.custom ? T.custom + " · " : ""}${time(e.at)}`));
      const det = el("div", "detail"); det.hidden = true;
      const dl = el("dl");
      const add = (k, v) => { dl.append(el("dt", null, k), el("dd", null, v)); };
      const p = e.params || {};
      if (p.value != null) add("value", String(p.value));
      if (p.currency) add("currency", String(p.currency));
      if (p.event_id) add("event_id", String(p.event_id));
      add(T.fromYolias, e.fromYolias ? T.yes : T.no);
      add(T.matched, e.matched ? T.yes : T.no);
      if (e.test) add(T.test, e.test);
      if (e.url) add(T.url, e.url);
      det.append(dl);
      for (const pr of e.problems) det.append(el("p", `p msg ${pr.level === "error" ? "err" : "warn"}`, T.p[pr.code] || pr.code));
      btn.addEventListener("click", () => { det.hidden = !det.hidden; });
      row.append(btn, det);
      card.append(row);
    }
    app.append(card);
  }
  for (const e of st.events.filter((x) => !x.pixel)) { const m = el("div", "pixel"); m.append(el("div", "msg err", `${e.event}: ${T.p.no_init}`)); app.append(m); }
});
