/* Yolias Pixel Helper — content script.
   Listens on the page for what the Yolias pixel announces ("yolias:pixel"
   DOM events, sent by yolias.com/px.js) and for the pixel's base code, and
   hands both to the background worker. It reads nothing else on the page. */
(function () {
  const send = (msg) => { try { chrome.runtime.sendMessage(msg); } catch (e) { /* extension reloaded */ } };
  const scan = () => {
    const attr = document.documentElement.getAttribute("data-yolias-pixel");
    const scripts = [...document.scripts].filter((s) => /\/px\.js(\?|$)/.test(s.src || "")).map((s) => s.src);
    const inline = [...document.scripts].some((s) => !s.src && /yolias\(\s*["']init["']/.test(s.textContent || ""));
    send({ type: "scan", url: location.href, ids: attr ? attr.split(",").filter(Boolean) : [], scripts, inline });
  };
  document.addEventListener("yolias:pixel", (e) => {
    let detail = null;
    try { detail = typeof e.detail === "string" ? JSON.parse(e.detail) : e.detail; } catch (err) { detail = null; }
    if (detail) send({ type: "event", url: location.href, detail });
  });
  document.addEventListener("DOMContentLoaded", scan);
  window.addEventListener("load", () => { scan(); setTimeout(scan, 1500); });
  new MutationObserver(scan).observe(document.documentElement, { attributes: true, attributeFilter: ["data-yolias-pixel"] });
})();
