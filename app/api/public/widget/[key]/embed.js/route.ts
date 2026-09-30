import type { NextRequest } from "next/server";

// Embeddable support widget (docs/bos/30 §10.5):
//   <script src="https://<bos-host>/api/public/widget/<KEY>/embed.js" async></script>
// Vanilla JS inside a Shadow DOM (no styles leak either way). All text is
// inserted with textContent — never as HTML. The API only answers pages on
// the widget's allowed domains, so a copied key is useless elsewhere.

const script = (api: string) => `(()=>{if(window.__bosWidget)return;window.__bosWidget=1;
const API=${JSON.stringify(api)};const TK="bos_widget_"+API.split("/").slice(-1)[0];
const L={ar:{send:"إرسال",ph:"اكتب رسالتك…",name:"الاسم",email:"البريد الإلكتروني",start:"ابدأ المحادثة",ai:"مساعد ذكي",agent:"فريق الدعم",close:"إغلاق",err:"تعذر الإرسال، حاول مرة أخرى.",off:"غير متاح الآن",typing:"يكتب…",open:"افتح الدعم"},en:{send:"Send",ph:"Type your message…",name:"Name",email:"Email",start:"Start chat",ai:"AI assistant",agent:"Support team",close:"Close",err:"Couldn't send, please try again.",off:"Offline now",typing:"Typing…",open:"Open support"}};
let cfg,t,token=null,since=null,timer=null,seen=new Set(),started=false;
try{token=localStorage.getItem(TK)}catch(e){}
const req=async(p,o={})=>{const h={"content-type":"application/json"};if(token)h["x-widget-token"]=token;const r=await fetch(API+p,{...o,headers:h,credentials:"omit"});const j=await r.json().catch(()=>({}));if(r.status===401&&token&&p!=="/session"){token=null;try{localStorage.removeItem(TK)}catch(e){}}if(!r.ok)throw Object.assign(new Error(j.error||"error"),{status:r.status});return j};
const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e};
async function init(){try{cfg=await req("/config")}catch(e){return}t=L[cfg.language]||L.ar;
const host=el("div");host.style.cssText="position:fixed;z-index:2147483000;bottom:"+cfg.bottom+"px;"+(cfg.position==="left"?"left":"right")+":20px";document.body.appendChild(host);
const root=host.attachShadow({mode:"open"});const dir=cfg.language==="ar"?"rtl":"ltr";
const st=el("style");st.textContent=":host{all:initial}*{box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif}.btn{width:56px;height:56px;border-radius:50%;border:0;background:"+cfg.color+";color:#fff;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);font-size:24px}.panel{position:absolute;bottom:68px;"+(cfg.position==="left"?"left":"right")+":0;width:min(360px,calc(100vw - 32px));height:min(520px,calc(100vh - 120px));background:#fff;color:#111;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden}.panel.open{display:flex}.hd{background:"+cfg.color+";color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center}.hd b{font-size:15px}.hd small{display:block;opacity:.85;font-size:12px}.x{background:none;border:0;color:#fff;font-size:20px;cursor:pointer}.list{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#f6f6f8}.m{max-width:82%;padding:8px 12px;border-radius:12px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}.me{align-self:flex-end;background:"+cfg.color+";color:#fff}.them{align-self:flex-start;background:#fff;border:1px solid #e5e5ea}.who{font-size:11px;opacity:.6;margin-bottom:2px}.ft{border-top:1px solid #eee;padding:10px;display:flex;gap:6px;flex-wrap:wrap}input,textarea{flex:1;min-width:0;border:1px solid #ddd;border-radius:8px;padding:8px 10px;font-size:14px;color:#111;background:#fff}textarea{resize:none;height:40px}.send{background:"+cfg.color+";color:#fff;border:0;border-radius:8px;padding:0 14px;cursor:pointer;font-size:14px}.err{color:#b00020;font-size:12px;width:100%}.typing{font-size:12px;opacity:.6;padding:0 12px 6px;background:#f6f6f8;display:none}";
root.appendChild(st);
const wrap=el("div");wrap.dir=dir;root.appendChild(wrap);
const panel=el("div","panel");const btn=el("button","btn","💬");btn.setAttribute("aria-label",t.open);
const hd=el("div","hd");const ht=el("div");ht.appendChild(el("b",null,cfg.title));ht.appendChild(el("small",null,cfg.online?(cfg.ai?t.ai:t.agent):t.off));const x=el("button","x","×");x.setAttribute("aria-label",t.close);hd.append(ht,x);
const list=el("div","list");const typing=el("div","typing",t.typing);const ft=el("div","ft");
panel.append(hd,list,typing,ft);wrap.append(panel,btn);
const add=(from,body)=>{const m=el("div","m "+(from==="me"?"me":"them"));if(from!=="me"){m.appendChild(el("div","who",from==="ai"?t.ai:t.agent))}m.appendChild(document.createTextNode(body));list.appendChild(m);list.scrollTop=list.scrollHeight};
add("agent",cfg.online?cfg.welcome:cfg.offline);
const nameI=el("input");nameI.placeholder=t.name;nameI.maxLength=120;const emailI=el("input");emailI.type="email";emailI.placeholder=t.email;emailI.maxLength=200;
const ta=el("textarea");ta.placeholder=t.ph;ta.maxLength=4000;const send=el("button","send",t.send);const err=el("div","err");
const needId=!token;if(needId){ft.append(nameI,emailI)}ft.append(ta,send,err);
async function poll(){if(!token)return;try{const r=await req("/messages"+(since?"?since="+encodeURIComponent(since):""));for(const m of r.messages){if(seen.has(m.id))continue;seen.add(m.id);since=m.at;add(m.from,m.body)}typing.style.display=r.ai&&r.messages.length&&r.messages[r.messages.length-1].from==="me"?"block":"none"}catch(e){}}
async function submit(){err.textContent="";const body=ta.value.trim();if(!body)return;if(needId&&cfg.requireEmail&&!emailI.value.trim()){emailI.focus();return}send.disabled=true;try{if(!token){const s=await req("/session",{method:"POST",body:JSON.stringify({page:location.href})});token=s.token;try{localStorage.setItem(TK,token)}catch(e){}}const r=await req("/messages",{method:"POST",body:JSON.stringify({body,name:nameI.value,email:emailI.value})});ta.value="";nameI.remove();emailI.remove();if(r.ai)typing.style.display="block";await poll()}catch(e){err.textContent=e.status===429?"…":t.err}finally{send.disabled=false}}
send.onclick=submit;ta.onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submit()}};
const toggle=o=>{panel.classList.toggle("open",o);if(o){if(!started){started=true;poll()}timer=timer||setInterval(poll,4000);ta.focus()}else{clearInterval(timer);timer=null}};
btn.onclick=()=>toggle(!panel.classList.contains("open"));x.onclick=()=>toggle(false);}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();})();`;

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^[0-9a-f]{16,64}$/.test(key)) return new Response("// invalid key", { status: 404, headers: { "content-type": "application/javascript" } });
  const api = `${req.nextUrl.origin}/api/public/widget/${key}`;
  return new Response(script(api), { headers: { "content-type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } });
}
