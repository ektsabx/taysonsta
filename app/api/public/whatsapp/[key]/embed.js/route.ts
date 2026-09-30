import type { NextRequest } from "next/server";
import { waWidgetByKey } from "@/services/bos/whatsapp-widgets";
import { waLink } from "@/lib/bos/messaging-utils";

// Click-to-WhatsApp button (docs/bos/30 §11):
//   <script src="https://<bos-host>/api/public/whatsapp/<KEY>/embed.js" async></script>
// Shadow DOM, textContent only; the click beacon counts clicks (allowed domains only).
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const w = await waWidgetByKey(key);
  const js = { "content-type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" };
  if (!w) return new Response("/* widget unavailable */", { headers: js });
  const cfg = { href: waLink(w.phone, w.greeting), label: w.label, side: w.position, bottom: w.bottom_offset, click: `${req.nextUrl.origin}/api/public/whatsapp/${key}/click` };
  const script = `(()=>{if(window.__bosWa)return;window.__bosWa=1;const c=${JSON.stringify(cfg)};
const go=()=>{const h=document.createElement("div");h.style.cssText="position:fixed;z-index:2147483000;bottom:"+c.bottom+"px;"+c.side+":20px";document.body.appendChild(h);const r=h.attachShadow({mode:"open"});
const s=document.createElement("style");s.textContent=":host{all:initial}a{display:flex;align-items:center;gap:8px;background:#25D366;color:#fff;text-decoration:none;font:600 14px system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;padding:12px 16px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.25)}svg{width:22px;height:22px;fill:#fff}";
const a=document.createElement("a");a.href=c.href;a.target="_blank";a.rel="noopener";a.setAttribute("aria-label",c.label);
a.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/></svg>';
const t=document.createElement("span");t.textContent=c.label;a.appendChild(t);
a.addEventListener("click",()=>{try{navigator.sendBeacon?navigator.sendBeacon(c.click):fetch(c.click,{method:"POST",mode:"cors",credentials:"omit",keepalive:true})}catch(e){}});
r.append(s,a)};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();})();`;
  return new Response(script, { headers: js });
}
