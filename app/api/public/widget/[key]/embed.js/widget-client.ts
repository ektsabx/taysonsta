// The support messenger that runs on a customer's site (docs/bos/30 §10.5,
// D-140, D-180). Intercom-style navigation in the site's own colours: a
// round launcher, then a Home tab (Need support? / How can we help? / Send us
// a message / Search for help), a Messages tab with the visitor's own
// conversations and a Help tab that searches the help articles. A
// conversation is created only when the first message is sent. Replies show
// who wrote them: the AI agent by name with an "AI" tag, staff by their name
// (and photo, if they allowed it). Resolved conversations can be rated.
// Vanilla JS inside a Shadow DOM — no styles leak either way. All text is
// inserted with textContent, never as HTML.
//
// Script tag options (all optional):
//   data-icon="/brand/logo-mark.png"  launcher + avatar image
//   data-launcher="hidden"             no floating button; open with window.bosWidget.open()
//   data-lang="ar|en"                  interface language (default: widget setting)
//   data-agent-name="Yolias Agent"     the AI's name (default: "<widget title> Agent")
// The API base is the script's own address, so a site can serve the widget
// from its own domain through a proxy (Yolias does, D-134).
// __FALLBACK_API__ is replaced by the server. No template literals or "${" in here.
export const WIDGET_JS = String.raw`(function(){if(window.__bosWidget)return;window.__bosWidget=1;
var CS=document.currentScript;
var API=(CS&&CS.src&&CS.src.replace(/\/embed\.js(?:\?.*)?$/,""))||__FALLBACK_API__;
var ICON=CS&&CS.getAttribute("data-icon");if(ICON){try{ICON=new URL(ICON,CS.src).href}catch(e){ICON=null}}
var HIDDEN=CS&&CS.getAttribute("data-launcher")==="hidden";
var LANGQ=CS&&CS.getAttribute("data-lang");
var AGENTQ=CS&&CS.getAttribute("data-agent-name");
var FONTQ=CS&&CS.getAttribute("data-font");
var TK="bos_widget_"+API.split("/").slice(-1)[0];
var L={
en:{need:"Need support?",how:"How can we help?",send:"Send us a message",search:"Search for help",home:"Home",messages:"Messages",help:"Help",
ph:"Message…",sendBtn:"Send",name:"Name",email:"Your email",ask:"Leave your email so we can reply even if you close this page.",
team:"Support team",close:"Close",back:"Back",err:"Couldn't send. Your message is still here; try again.",slow:"Too many messages. Please wait a moment.",
on:"We typically reply in a few minutes",off:"We're away. We'll reply by email.",open:"Open support",you:"You",now:"Just now",ai:"AI",
noMsgTitle:"No messages yet",noMsg:"Your conversations with the team will appear here.",loading:"Loading…",loadErr:"Couldn't load. Check your connection and try again.",retry:"Try again",
resolved:"Resolved",openS:"Open",searchPh:"Search for help",noResults:"No results for",helpHint:"Search the help articles, or send us a message.",
stillNeed:"Can't find an answer?",human:"Talk to a person",waiting:"You're in the queue. A teammate will reply here soon.",
rateQ:"How was the support you received?",rateComment:"Anything to add? (optional)",rateSend:"Send rating",
rateThanks:"Thanks for your feedback.",star:"stars",newConv:"New conversation",agentLabel:"Support team",sending:"Sending…",humanErr:"Couldn't reach the team. Try again."},
ar:{need:"تحتاج مساعدة؟",how:"كيف يمكننا مساعدتك؟",send:"أرسل لنا رسالة",search:"ابحث في المساعدة",home:"الرئيسية",messages:"الرسائل",help:"المساعدة",
ph:"اكتب رسالة…",sendBtn:"إرسال",name:"الاسم",email:"بريدك الإلكتروني",ask:"اترك بريدك لنرد عليك حتى لو أغلقت الصفحة.",
team:"فريق الدعم",close:"إغلاق",back:"رجوع",err:"تعذّر الإرسال. رسالتك ما زالت هنا، حاول مرة أخرى.",slow:"أرسلت رسائل كثيرة، انتظر قليلًا.",
on:"عادةً نرد خلال دقائق",off:"نحن خارج ساعات العمل، وسنرد عبر البريد.",open:"افتح الدعم",you:"أنت",now:"الآن",ai:"ذكاء اصطناعي",
noMsgTitle:"لا توجد رسائل بعد",noMsg:"ستظهر هنا محادثاتك مع الفريق.",loading:"جارٍ التحميل…",loadErr:"تعذّر التحميل. تحقق من اتصالك وحاول مرة أخرى.",retry:"حاول مرة أخرى",
resolved:"تم الحل",openS:"مفتوحة",searchPh:"ابحث في المساعدة",noResults:"لا توجد نتائج لـ",helpHint:"ابحث في مقالات المساعدة، أو أرسل لنا رسالة.",
stillNeed:"لم تجد إجابة؟",human:"تحدّث مع شخص من الفريق",waiting:"أنت في قائمة الانتظار، وسيرد عليك أحد أعضاء الفريق هنا قريبًا.",
rateQ:"ما تقييمك للدعم الذي حصلت عليه؟",rateComment:"هل تريد إضافة شيء؟ (اختياري)",rateSend:"إرسال التقييم",
rateThanks:"شكرًا على تقييمك.",star:"نجوم",newConv:"محادثة جديدة",agentLabel:"فريق الدعم",sending:"جارٍ الإرسال…",humanErr:"تعذّر الوصول إلى الفريق. حاول مرة أخرى."}};
var cfg,t,token=null,openNow=false,pendingOpen=false,built=false;
try{token=localStorage.getItem(TK)}catch(e){}
function saveToken(v){token=v;try{if(v)localStorage.setItem(TK,v);else localStorage.removeItem(TK)}catch(e){}}
function req(p,o){o=o||{};var h={"content-type":"application/json"};if(token)h["x-widget-token"]=token;
return fetch(API+p,{method:o.method||"GET",body:o.body,headers:h,credentials:"omit"}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){
if(r.status===401&&token&&p!=="/session"){saveToken(null)}
if(!r.ok){var e=new Error(j.error||"error");e.status=r.status;throw e}return j})})}
function ensureSession(){if(token)return Promise.resolve();return req("/session",{method:"POST",body:JSON.stringify({page:location.href})}).then(function(s){saveToken(s.token)})}
// A session that no longer fits (signed in or out since) is refused once; a new one is made.
function withSession(fn){return ensureSession().then(fn).catch(function(e){if(e&&e.status===401){saveToken(null);return ensureSession().then(fn)}throw e})}
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function svg(d,size){var s=document.createElementNS("http://www.w3.org/2000/svg","svg");s.setAttribute("viewBox","0 0 24 24");s.setAttribute("width",size||24);s.setAttribute("height",size||24);s.setAttribute("aria-hidden","true");
var p=document.createElementNS("http://www.w3.org/2000/svg","path");p.setAttribute("d",d);p.setAttribute("fill","currentColor");s.appendChild(p);return s}
var I={chat:"M12 3C6.48 3 2 6.92 2 11.75c0 2.43 1.14 4.62 2.97 6.2-.13 1.42-.62 2.73-1.45 3.75 2.1-.1 3.94-.83 5.25-1.88 1 .27 2.08.43 3.23.43 5.52 0 10-3.92 10-8.75S17.52 3 12 3z",
down:"M12 15.4 5.3 8.7a1 1 0 0 1 1.4-1.4L12 12.6l5.3-5.3a1 1 0 1 1 1.4 1.4L12 15.4z",
x:"M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 0 0-1.4 1.4L10.6 12l-4.9 4.9a1 1 0 1 0 1.4 1.4L12 13.4l4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4z",
up:"M12 4.6l6.7 6.7a1 1 0 0 1-1.4 1.4L13 8.4V19a1 1 0 1 1-2 0V8.4l-4.3 4.3a1 1 0 1 1-1.4-1.4L12 4.6z",
home:"M12 3.2 2.6 11a1 1 0 0 0 1.3 1.5L5 11.6V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-8.4l1.1.9A1 1 0 0 0 21.4 11L12 3.2z",
msgs:"M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2zm3 5a1 1 0 0 0 0 2h10a1 1 0 0 0 0-2H7zm0 4a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2H7z",
help:"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 16a1.25 1.25 0 1 1 0-2.5A1.25 1.25 0 0 1 12 18zm1.6-5.7c-.7.5-.9.8-.9 1.4a.7.7 0 0 1-1.4 0c0-1.2.6-1.8 1.4-2.4.7-.5 1.1-.9 1.1-1.6 0-.9-.8-1.6-1.8-1.6s-1.8.7-1.9 1.6a.7.7 0 0 1-1.4-.1C8.8 7.8 10.2 6.6 12 6.6s3.2 1.3 3.2 3c0 1.3-.7 2-1.6 2.7z",
search:"M10.5 3a7.5 7.5 0 0 1 6 12l4.2 4.2a1 1 0 0 1-1.4 1.4l-4.2-4.2A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z",
send:"M3.4 20.4 21 12 3.4 3.6a.8.8 0 0 0-1.1 1l2.2 6.4 8.5 1-8.5 1-2.2 6.4a.8.8 0 0 0 1.1 1z",
back:"M15.7 5.3a1 1 0 0 1 0 1.4L10.4 12l5.3 5.3a1 1 0 0 1-1.4 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0z",
bot:"M12 2a1 1 0 0 1 1 1v1.1A7 7 0 0 1 19 11v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-5a7 7 0 0 1 6-6.9V3a1 1 0 0 1 1-1zM9 11.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z",
ext:"M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14V3zM5 5h6v2H6v11h11v-5h2v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
star:"M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 2.8z"};
function brandAvatar(cls){var a=el("span",cls||"av");if(ICON){var i=el("img");i.src=ICON;i.alt="";a.appendChild(i)}else{a.appendChild(svg(I.chat,16))}return a}
function authorAvatar(au,cls){var a=el("span",cls||"av");
if(au&&au.kind==="ai"){a.classList.add("bot");a.appendChild(svg(I.bot,15));return a}
if(au&&au.kind==="agent"){if(au.photo){var i=el("img","ph");i.alt="";i.src=API+"/"+au.photo+(au.photo.indexOf("?")<0?"?":"&")+"t="+encodeURIComponent(token||"");a.appendChild(i);return a}
var n=(au.name||"").trim();if(n){a.classList.add("ini");a.textContent=n.split(/\s+/).map(function(w){return w.charAt(0)}).slice(0,2).join("").toUpperCase();return a}}
return brandAvatar(cls)}
var LOC="en";
function ago(iso){var s=(Date.now()-Date.parse(iso))/1000;if(!(s>=0))return"";if(s<60)return t.now;
try{var rtf=new Intl.RelativeTimeFormat(LOC,{numeric:"auto",style:"short"});
if(s<3600)return rtf.format(-Math.round(s/60),"minute");if(s<86400)return rtf.format(-Math.round(s/3600),"hour");if(s<604800)return rtf.format(-Math.round(s/86400),"day")}catch(e){}
try{return new Date(iso).toLocaleDateString(LOC)}catch(e){return""}}
function init(n){n=typeof n==="number"?n:0;req("/config").then(function(c){cfg=c;build()}).catch(function(e){if(n<3&&!(e&&e.status&&e.status<500))setTimeout(function(){init(n+1)},[2e3,8e3,3e4][n])})}
function build(){if(built)return;built=true;
var lang=LANGQ==="ar"||LANGQ==="en"?LANGQ:cfg.language;t=L[lang]||L.en;LOC=lang==="ar"?"ar":"en";var rtl=lang==="ar";var side=cfg.position==="left"?"left":"right";
var AGENT=AGENTQ||((cfg.title||"AI").replace(/\s*(support|الدعم)\s*$/i,"")+" Agent");
var host=el("div");host.setAttribute("data-bos-widget","");host.style.cssText="position:fixed;z-index:2147483000;bottom:0;"+side+":0;width:0;height:0";document.body.appendChild(host);
var root=host.attachShadow({mode:"open"});var C=cfg.color;var B=(cfg.bottom||20);
// data-font="inherit": use the host page's own font (its @font-face rules apply inside the shadow root), e.g. Yolias's Arabic font.
var FF="";if(FONTQ==="inherit"){try{FF=(getComputedStyle(document.body).fontFamily||"").replace(/[;{}<>]/g,"")}catch(e){}}
var css=":host{all:initial}"+
"*{box-sizing:border-box;margin:0;font-family:"+(FF?FF+",":"")+"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Kufi Arabic','Noto Sans Arabic',Tahoma,sans-serif;-webkit-font-smoothing:antialiased}"+
"button{font:inherit}"+
".launcher{position:fixed;bottom:"+B+"px;"+side+":20px;width:52px;height:52px;border-radius:50%;border:0;padding:0;background:"+C+";color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 6px 0 rgba(0,0,0,.06),0 2px 32px 0 rgba(0,0,0,.16);transition:transform .167s cubic-bezier(.33,0,0,1);outline:none}"+
".launcher:hover{transform:scale(1.08)}.launcher:active{transform:scale(.95)}.launcher:focus-visible{box-shadow:0 0 0 3px #fff,0 0 0 5px "+C+"}"+
".launcher .ic{position:absolute;display:flex;transition:transform .16s linear,opacity .08s linear}.launcher .ic img{width:28px;height:28px;object-fit:contain;filter:brightness(0) invert(1)}"+
".launcher .ic.b{opacity:0;transform:rotate(-30deg) scale(.5)}.open .launcher .ic.a{opacity:0;transform:rotate(30deg) scale(.5)}.open .launcher .ic.b{opacity:1;transform:none}"+
".hidden-launcher .launcher{display:none}"+
".m{position:fixed;"+side+":20px;bottom:"+(B+68)+"px;width:400px;height:min(704px,calc(100vh - "+(B+88)+"px));max-height:704px;border-radius:16px;background:#fff;color:#1a1a1a;box-shadow:0 5px 40px rgba(0,0,0,.16);display:flex;flex-direction:column;overflow:hidden;opacity:0;visibility:hidden;transform:translateY(8px) scale(.97);transform-origin:bottom "+side+";transition:opacity .2s ease,transform .3s cubic-bezier(0,1.2,1,1),visibility 0s .3s}"+
".hidden-launcher .m{bottom:"+B+"px;height:min(704px,calc(100vh - "+(B+20)+"px))}"+
".open .m{opacity:1;visibility:visible;transform:none;transition:opacity .2s ease,transform .3s cubic-bezier(0,1.2,1,1),visibility 0s}"+
".x,.bk{flex:none;width:32px;height:32px;border-radius:8px;border:0;background:transparent;color:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:.8}.x:hover,.bk:hover{opacity:1;background:rgba(127,127,127,.15)}"+
".rtl .bk svg{transform:scaleX(-1)}"+
".view{flex:1;min-height:0;display:none;flex-direction:column}.view.on{display:flex}"+
".hero{background:"+C+";color:#fff;padding:20px 20px 64px;position:relative}"+
".hero .top{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px}.hero .av{width:36px;height:36px;background:rgba(255,255,255,.95)}"+
".hero p{font-size:20px;opacity:.85;font-weight:600;line-height:1.3}.hero h2{font-size:26px;font-weight:700;line-height:1.25;margin-top:2px}"+
".scroll{flex:1;overflow-y:auto;overscroll-behavior:contain}"+
".homecards{padding:0 16px 16px;margin-top:-48px;position:relative;display:flex;flex-direction:column;gap:12px}"+
".card{display:flex;align-items:center;gap:12px;width:100%;text-align:start;background:#fff;border:1px solid #ececec;border-radius:12px;padding:16px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.06);color:#1a1a1a;transition:border-color .15s,box-shadow .15s}"+
".card:hover{border-color:#d6d6da;box-shadow:0 4px 14px rgba(0,0,0,.08)}.card:focus-visible{outline:2px solid "+C+";outline-offset:2px}"+
".card .ct{flex:1;min-width:0}.card b{display:block;font-size:15px;font-weight:600}.card small{display:block;font-size:13px;color:#737376;margin-top:2px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.card .ce{flex:none;color:"+C+";display:flex}"+
".rtl .card .ce svg{transform:scaleX(-1)}"+
".dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#2ec27e;margin-inline-end:6px;vertical-align:1px}.dot.off{background:#c4c4c8}"+
".bar{display:flex;align-items:center;gap:8px;padding:14px 12px;border-bottom:1px solid #f0f0f0;min-height:60px}.bar h3{flex:1;font-size:16px;font-weight:600;text-align:center}.bar .ttl{flex:1;min-width:0;display:flex;align-items:center;gap:10px}"+
".ttl .nm{display:block;font-size:15px;font-weight:600;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ttl small{display:block;font-size:12px;color:#737376}"+
".spacer{width:32px;flex:none}"+
".tabs{display:flex;border-top:1px solid #f0f0f0;background:#fff}.tab{flex:1;border:0;background:transparent;padding:10px 4px 12px;cursor:pointer;color:#737376;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;font-weight:600}"+
".tab[aria-selected=true]{color:"+C+"}.tab:focus-visible{outline:2px solid "+C+";outline-offset:-2px}"+
".item{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:start;border:0;background:#fff;border-bottom:1px solid #f4f4f5;padding:14px 16px;cursor:pointer;color:#1a1a1a}"+
".item:hover{background:#fafafa}.item:focus-visible{outline:2px solid "+C+";outline-offset:-2px}.item .it{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}.item .r1{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#737376}"+
".item .pv{font-size:14px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}"+
".pill{align-self:flex-start;font-size:11px;font-weight:600;border-radius:999px;padding:1px 8px;background:#eef9f2;color:#1f7a45}.pill.op{background:#f2f3f5;color:#55555a}"+
".empty{padding:48px 24px;text-align:center;color:#737376;font-size:14px;line-height:1.5}.empty b{display:block;color:#1a1a1a;font-size:16px;margin-bottom:6px}"+
".btn{display:inline-flex;align-items:center;gap:8px;border:0;border-radius:999px;background:"+C+";color:#fff;font-size:14px;font-weight:600;padding:10px 18px;cursor:pointer;margin-top:16px}.btn:disabled{opacity:.6;cursor:default}"+
".lnk{border:0;background:none;color:"+C+";font-weight:600;font-size:13px;cursor:pointer;padding:4px 0}.lnk:disabled{opacity:.6}"+
".sbox{padding:16px;border-bottom:1px solid #f0f0f0}.sin{display:flex;align-items:center;gap:8px;border:1px solid #e3e3e6;border-radius:10px;padding:0 12px;background:#f7f7f8}.sin:focus-within{border-color:"+C+";background:#fff}"+
".sin svg{flex:none;color:#9a9aa0}.sin input{border:0;background:transparent;height:42px;padding:0}"+
".res{display:block;width:100%;text-align:start;border:0;background:#fff;border-bottom:1px solid #f4f4f5;padding:14px 16px;cursor:pointer;color:#1a1a1a}.res:hover{background:#fafafa}.res b{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:14px;font-weight:600}.res small{display:block;font-size:13px;color:#737376;margin-top:3px;line-height:1.45}"+
".res b svg{flex:none;color:#9a9aa0}.art{padding:20px;font-size:14px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere}"+
".chat{flex:1;overflow-y:auto;padding:16px 16px 8px;display:flex;flex-direction:column;gap:4px;overscroll-behavior:contain}"+
".row{display:flex;align-items:flex-end;gap:8px;max-width:100%}.row.me{justify-content:flex-end}.row .av{width:28px;height:28px;margin-bottom:20px}"+
".col{display:flex;flex-direction:column;max-width:80%}.me .col{align-items:flex-end}"+
".who{font-size:12px;color:#737376;padding:0 4px 3px;display:flex;align-items:center;gap:6px}.tag{font-size:10px;font-weight:700;border-radius:4px;padding:0 5px;background:#eef0ff;color:#4a4fc4;letter-spacing:.03em}"+
".bub{padding:11px 15px;border-radius:18px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere}"+
".them .bub{background:#f2f3f5;color:#1a1a1a;border-end-start-radius:6px}.me .bub{background:"+C+";color:#fff;border-end-end-radius:6px}.me.fail .bub{opacity:.55}"+
".meta{font-size:11px;color:#9a9aa0;padding:3px 4px 8px}"+
".note{align-self:center;font-size:12px;color:#55555a;background:#f7f7f8;border-radius:999px;padding:6px 12px;margin:6px 0;text-align:center}"+
".typing{display:none}.typing.on{display:flex}.dots{display:flex;gap:4px;padding:14px}.dots i{width:6px;height:6px;border-radius:50%;background:#9a9aa0;animation:bw 1.2s infinite ease-in-out}.dots i:nth-child(2){animation-delay:.15s}.dots i:nth-child(3){animation-delay:.3s}"+
"@keyframes bw{0%,60%,100%{opacity:.35;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}"+
".box2{margin:4px 0 12px;padding:14px;border:1px solid #ececec;border-radius:12px;background:#fff;display:flex;flex-direction:column;gap:8px}.box2 p{font-size:13px;color:#55555a;line-height:1.45}"+
".stars{display:flex;gap:4px}.stars button{border:0;background:none;color:#d4d4d8;cursor:pointer;padding:2px;display:flex}.stars button.on{color:#f5a524}.stars button:focus-visible{outline:2px solid "+C+";border-radius:4px}"+
"input,textarea.cm{width:100%;border:1px solid #e3e3e6;border-radius:8px;padding:0 12px;font-size:14px;color:#1a1a1a;background:#fff;outline:none;transition:border-color .15s}input{height:40px}textarea.cm{padding:8px 12px;resize:vertical;min-height:60px}input:focus,textarea.cm:focus{border-color:"+C+"}"+
".ft{padding:8px 16px 14px;border-top:1px solid #f4f4f5}.box{display:flex;align-items:flex-end;gap:8px;border:1px solid #e3e3e6;border-radius:24px;padding:6px;padding-inline-start:16px;background:#fff;transition:border-color .15s,box-shadow .15s}.box:focus-within{border-color:#c9c9ce;box-shadow:0 2px 8px rgba(0,0,0,.06)}"+
"textarea.ta{flex:1;min-width:0;border:0;outline:none;resize:none;font-size:14px;line-height:20px;max-height:120px;padding:8px 0;color:#1a1a1a;background:transparent}textarea::placeholder,input::placeholder{color:#9a9aa0}"+
".snd{flex:none;width:36px;height:36px;border-radius:50%;border:0;background:#f2f3f5;color:#9a9aa0;cursor:default;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s,transform .1s}"+
".snd.ready{background:"+C+";color:#fff;cursor:pointer}.snd.ready:active{transform:scale(.92)}"+
".err{font-size:12px;color:#d0342c;padding:0 8px 6px}.err:empty{display:none}.subrow{display:flex;justify-content:center;padding:4px 0}"+
".av{flex:none;width:32px;height:32px;border-radius:50%;background:#fff;border:1px solid #ececec;display:flex;align-items:center;justify-content:center;overflow:hidden;color:"+C+"}.av img{width:20px;height:20px;object-fit:contain}.av img.ph{width:100%;height:100%;object-fit:cover}"+
".av.bot{background:"+C+";color:#fff;border-color:transparent}.av.ini{background:#262626;color:#fff;font-size:11px;font-weight:700;border-color:transparent}"+
".muted{color:#737376;font-size:13px;padding:16px;text-align:center}"+
"@media (max-width:450px){.m{"+side+":0;bottom:0;width:100vw;height:100%;max-height:none;border-radius:0}.open .launcher{display:none}}"+
"@media (prefers-reduced-motion:reduce){.m,.launcher,.launcher .ic,.card{transition:none}.dots i{animation:none}}";
var st=el("style");st.textContent=css;root.appendChild(st);
var wrap=el("div",(HIDDEN?"hidden-launcher":"")+(rtl?" rtl":""));wrap.dir=rtl?"rtl":"ltr";wrap.lang=lang;root.appendChild(wrap);
var btn=el("button","launcher");btn.type="button";btn.setAttribute("aria-label",t.open);btn.setAttribute("aria-expanded","false");
var ia=el("span","ic a");if(ICON){var li=el("img");li.src=ICON;li.alt="";ia.appendChild(li)}else{ia.appendChild(svg(I.chat,28))}
var ib=el("span","ic b");ib.appendChild(svg(I.down,28));btn.append(ia,ib);
var m=el("div","m");m.setAttribute("role","dialog");m.setAttribute("aria-label",cfg.title);
function closeBtn(){var x=el("button","x");x.type="button";x.setAttribute("aria-label",t.close);x.appendChild(svg(I.x,20));x.onclick=function(){toggle(false)};return x}
function bar(title,back){var b=el("div","bar");if(back){var k=el("button","bk");k.type="button";k.setAttribute("aria-label",t.back);k.appendChild(svg(I.back,20));k.onclick=back;b.appendChild(k)}else{b.appendChild(el("span","spacer"))}
b.append(el("h3",null,title),closeBtn());return b}
function emptyBox(title,text,label,fn){var p=el("div","empty");if(title)p.appendChild(el("b",null,title));if(text)p.appendChild(document.createTextNode(text));if(label){var nb=el("button","btn",label);nb.type="button";nb.onclick=fn;p.appendChild(el("br"));p.appendChild(nb)}return p}

/* Home */
var vHome=el("div","view");var hs=el("div","scroll");var hero=el("div","hero");var top=el("div","top");top.append(brandAvatar(),closeBtn());
hero.append(top,el("p",null,t.need),el("h2",null,t.how));
var cards=el("div","homecards");
function card(icon,title,sub,fn){var c=el("button","card");c.type="button";var ct=el("span","ct");ct.appendChild(el("b",null,title));if(sub)ct.appendChild(sub);var ce=el("span","ce");ce.appendChild(svg(icon,20));c.append(ct,ce);c.onclick=fn;return c}
var avail=el("small");avail.append(el("span","dot"+(cfg.online?"":" off")),document.createTextNode(cfg.online?t.on:t.off));
var recent=el("div");
cards.append(card(I.send,t.send,avail,function(){openChat(null)}));
if(cfg.help!==false)cards.appendChild(card(I.search,t.search,null,function(){show("help");setTimeout(function(){sIn.focus()},60)}));
cards.appendChild(recent);
hs.append(hero,cards);vHome.appendChild(hs);

/* Messages */
var vMsgs=el("div","view");var mList=el("div","scroll");vMsgs.append(bar(t.messages),mList);
function loadConversations(){mList.textContent="";mList.appendChild(el("p","muted",t.loading));
if(!token){renderConversations([]);return}
req("/conversations").then(function(r){renderConversations(r.conversations||[])}).catch(function(e){if(e&&e.status===401){renderConversations([]);return}
mList.textContent="";mList.appendChild(emptyBox(null,t.loadErr,t.retry,loadConversations))})}
function renderConversations(list){mList.textContent="";renderRecent(list);
if(!list.length){mList.appendChild(emptyBox(t.noMsgTitle,t.noMsg,t.send,function(){openChat(null)}));return}
list.forEach(function(c){var it=el("button","item");it.type="button";
it.appendChild(c.from==="ai"?authorAvatar({kind:"ai"}):brandAvatar());var tx=el("span","it");var r1=el("span","r1");
r1.append(el("span",null,c.from==="me"?t.you:c.from==="ai"?AGENT:t.team),el("span",null,ago(c.at)));
tx.append(r1,el("span","pv",c.preview||""),el("span","pill"+(c.status==="resolved"?"":" op"),c.status==="resolved"?t.resolved:t.openS));
it.appendChild(tx);it.onclick=function(){openChat(c.id)};mList.appendChild(it)});
var nc=el("div","subrow");var nb2=el("button","btn",t.newConv);nb2.type="button";nb2.onclick=function(){openChat(null)};nc.appendChild(nb2);mList.appendChild(nc)}
function renderRecent(list){recent.textContent="";var o=null;for(var i=0;i<list.length;i++){if(list[i].status!=="resolved"){o=list[i];break}}
if(!o)return;recent.appendChild(card(I.msgs,t.messages,el("small",null,o.preview||""),function(){openChat(o.id)}))}

/* Help */
var vHelp=el("div","view");var sBox=el("div","sbox");var sin=el("label","sin");sin.appendChild(svg(I.search,18));var sIn=el("input");sIn.type="search";sIn.placeholder=t.searchPh;sIn.setAttribute("aria-label",t.searchPh);sIn.maxLength=100;sin.appendChild(sIn);sBox.appendChild(sin);
var hRes=el("div","scroll");hRes.setAttribute("aria-live","polite");vHelp.append(bar(t.help),sBox,hRes);
var hTimer=null,hSeq=0;
function helpIdle(){hRes.textContent="";hRes.appendChild(el("p","muted",t.helpHint))}
function helpSearch(){var q=sIn.value.trim();clearTimeout(hTimer);if(q.length<2){helpIdle();return}
hTimer=setTimeout(function(){var my=++hSeq;hRes.textContent="";hRes.appendChild(el("p","muted",t.loading));
req("/help?q="+encodeURIComponent(q)+"&lang="+lang).then(function(r){if(my!==hSeq)return;hRes.textContent="";var rs=r.results||[];
if(!rs.length){hRes.appendChild(emptyBox(t.noResults+" “"+q+"”",t.stillNeed,t.send,function(){openChat(null)}));return}
rs.forEach(function(a){var b=el("button","res");b.type="button";var h=el("b",null,a.title);if(a.url)h.appendChild(svg(I.ext,15));b.append(h,el("small",null,a.summary||""));
b.onclick=function(){if(a.url){var u;try{u=new URL(a.url,location.href)}catch(e){return}if(u.protocol!=="https:"&&u.protocol!=="http:")return;window.open(u.href,"_blank","noopener")}else if(a.body){showArticle(a)}};hRes.appendChild(b)});
var more=el("div","subrow");var lb=el("button","lnk",t.stillNeed+" "+t.send);lb.type="button";lb.onclick=function(){openChat(null)};more.appendChild(lb);hRes.appendChild(more)})
.catch(function(){if(my!==hSeq)return;hRes.textContent="";hRes.appendChild(emptyBox(null,t.loadErr,t.retry,helpSearch))})},250)}
sIn.addEventListener("input",helpSearch);
var vArt=el("div","view");
function showArticle(a){vArt.textContent="";var sc=el("div","scroll");var ar=el("div","art");ar.appendChild(el("b",null,a.title));ar.appendChild(document.createTextNode("\n\n"+a.body));sc.appendChild(ar);vArt.append(bar(t.help,function(){show("help")}),sc);show("art")}

/* Chat */
var vChat=el("div","view");var cBar=el("div","bar");var cBack=el("button","bk");cBack.type="button";cBack.setAttribute("aria-label",t.back);cBack.appendChild(svg(I.back,20));
var cTtl=el("div","ttl");var cAv=el("span");var cTxt=el("span");var cName=el("span","nm");var cSub=el("small");cTxt.append(cName,cSub);cTtl.append(cAv,cTxt);cBar.append(cBack,cTtl,closeBtn());
var list=el("div","chat");list.setAttribute("aria-live","polite");
var typing=el("div","row them typing");var tc=el("div","col");var tb=el("div","bub dots");tb.append(el("i"),el("i"),el("i"));tc.appendChild(tb);typing.append(authorAvatar({kind:"ai"}),tc);
var ft=el("div","ft");var err=el("div","err");err.setAttribute("role","alert");var hrow=el("div","subrow");var hBtn=el("button","lnk",t.human);hBtn.type="button";hrow.appendChild(hBtn);hrow.style.display="none";
var box=el("div","box");var ta=el("textarea","ta");ta.rows=1;ta.placeholder=t.ph;ta.maxLength=4000;ta.setAttribute("aria-label",t.ph);
var snd=el("button","snd");snd.type="button";snd.setAttribute("aria-label",t.sendBtn);snd.appendChild(svg(I.up,20));box.append(ta,snd);ft.append(err,hrow,box);
vChat.append(cBar,list,ft);
var conv=null,since=null,seen={},timer=null,card2=null,nameI=null,emailI=null,busy=false,lastFrom=null,state={ai:false,waitingHuman:false,canRate:false,rated:null},extras=null,prevView="home",view="home";
// The header names who is answering: the AI agent (with its AI tag), the staff member, or the team.
function setHeader(au){cAv.textContent="";var who=au||(cfg.ai?{kind:"ai"}:null);cAv.appendChild(authorAvatar(who));
cName.textContent=who&&who.kind==="agent"?(who.name||t.team):who&&who.kind==="ai"?AGENT:cfg.title;
cSub.textContent="";if(who&&who.kind==="ai")cSub.append(el("span","tag",t.ai),document.createTextNode(" "));else if(who&&who.kind==="agent")cSub.appendChild(document.createTextNode(t.agentLabel+" · "));
cSub.appendChild(document.createTextNode(cfg.online?t.on:t.off))}
function resetChat(){list.textContent="";list.appendChild(typing);seen={};since=null;lastFrom=null;card2=null;extras=null;state={ai:!!cfg.ai,waitingHuman:false,canRate:false,rated:null};err.textContent="";typing.classList.remove("on");hrow.style.display="none"}
function addMsg(mm,pending){var me=mm.from==="me";var r=el("div","row "+(me?"me":"them"));var c=el("div","col");
var au=mm.author||{kind:mm.from};var key=au.kind+":"+(au.name||"");
if(!me&&lastFrom!==key){var w=el("div","who");w.appendChild(document.createTextNode(au.kind==="ai"?AGENT:(au.name||t.team)));if(au.kind==="ai")w.appendChild(el("span","tag",t.ai));c.appendChild(w)}
var bb=el("div","bub",mm.body);bb.dir="auto";c.appendChild(bb);
if(!me){if(lastFrom!==key){r.appendChild(authorAvatar(au))}else{var sp=el("span");sp.style.cssText="width:28px;flex:none";r.appendChild(sp)}}
r.appendChild(c);if(pending)r.classList.add("pend");
list.insertBefore(r,extras&&extras.parentNode===list?extras:typing);lastFrom=me?"me":key;
c.appendChild(el("div","meta",mm.at?ago(mm.at):(pending?t.sending:"")));
if(!me&&mm.at)setHeader(au);list.scrollTop=list.scrollHeight;return r}
function renderExtras(){if(extras&&extras.parentNode)extras.remove();extras=el("div");
if(state.waitingHuman)extras.appendChild(el("div","note",t.waiting));
if(state.canRate){var bx=el("div","box2");bx.appendChild(el("p",null,t.rateQ));var stars=el("div","stars");stars.setAttribute("role","radiogroup");stars.setAttribute("aria-label",t.rateQ);var val=0;var sb=[];
var cm=el("textarea","cm");cm.placeholder=t.rateComment;cm.maxLength=2000;cm.setAttribute("aria-label",t.rateComment);var go=el("button","btn",t.rateSend);go.type="button";go.disabled=true;
for(var i=1;i<=5;i++){(function(n){var s=el("button");s.type="button";s.setAttribute("role","radio");s.setAttribute("aria-label",n+" "+t.star);s.setAttribute("aria-checked","false");s.appendChild(svg(I.star,26));
s.onclick=function(){val=n;sb.forEach(function(x,j){x.classList.toggle("on",j<n);x.setAttribute("aria-checked",j===n-1?"true":"false")});go.disabled=false};sb.push(s);stars.appendChild(s)})(i)}
go.onclick=function(){if(!val)return;go.disabled=true;err.textContent="";req("/rating",{method:"POST",body:JSON.stringify({conversation:conv,rating:val,comment:cm.value})}).then(function(){state.canRate=false;state.rated=val;renderExtras()}).catch(function(){go.disabled=false;err.textContent=t.err})};
bx.append(stars,cm,go);extras.appendChild(bx)}
else if(state.rated){extras.appendChild(el("div","note",t.rateThanks))}
list.insertBefore(extras,typing);hrow.style.display=conv&&state.ai&&!state.canRate?"flex":"none"}
function poll(){if(!token||!conv)return Promise.resolve();var my=conv;
return req("/messages?c="+encodeURIComponent(conv)+(since?"&since="+encodeURIComponent(since):"")).then(function(r){if(my!==conv)return;
for(var i=0;i<r.messages.length;i++){var mm=r.messages[i];since=mm.at;if(seen[mm.id])continue;seen[mm.id]=1;
var pd=mm.from==="me"?list.querySelector(".pend"):null;
if(pd){pd.classList.remove("pend");var mt=pd.querySelector(".meta");if(mt)mt.textContent=ago(mm.at);continue}addMsg(mm)}
state={ai:!!r.ai,waitingHuman:!!r.waitingHuman,canRate:!!r.canRate,rated:r.rated};
renderExtras();typing.classList.toggle("on",!!(r.ai&&lastFrom==="me"))}).catch(function(){})}
function openChat(id){if(view!=="chat")prevView=view;resetChat();conv=id;setHeader(null);show("chat");
if(!id){addMsg({from:cfg.ai?"ai":"agent",author:cfg.ai?{kind:"ai"}:{kind:"team",name:cfg.title},body:cfg.online?cfg.welcome:cfg.offline,at:null});
if(!token&&!cfg.identified){card2=el("div","box2");card2.appendChild(el("p",null,t.ask));nameI=el("input");nameI.placeholder=t.name;nameI.maxLength=120;nameI.autocomplete="name";nameI.setAttribute("aria-label",t.name);
emailI=el("input");emailI.type="email";emailI.placeholder=t.email;emailI.maxLength=200;emailI.autocomplete="email";emailI.setAttribute("aria-label",t.email);card2.append(nameI,emailI);list.insertBefore(card2,typing)}
renderExtras()}else{poll()}
timer=timer||setInterval(function(){if(view==="chat"&&openNow)poll()},4000);setTimeout(function(){(card2&&cfg.requireEmail&&emailI&&!emailI.value?nameI:ta).focus()},120)}
cBack.onclick=function(){conv=null;var to=prevView==="chat"||prevView==="art"?"home":prevView;show(to);if(to==="messages")loadConversations()};
function grow(){ta.style.height="auto";ta.style.height=Math.min(ta.scrollHeight,120)+"px";snd.classList.toggle("ready",!!ta.value.trim()&&!busy)}
ta.addEventListener("input",grow);
function submit(){err.textContent="";var body=ta.value.trim();if(!body||busy)return;
if(card2&&cfg.requireEmail&&emailI&&!emailI.value.trim()){emailI.focus();return}
busy=true;ta.value="";grow();var bubble=addMsg({from:"me",body:body,at:null},true);
withSession(function(){return req("/messages",{method:"POST",body:JSON.stringify({body:body,conversation:conv,name:nameI?nameI.value:"",email:emailI?emailI.value:""})})}).then(function(r){
conv=r.conversation||conv;if(card2){card2.remove();card2=null}state.ai=!!r.ai;if(r.ai)typing.classList.add("on");renderExtras();return poll()})
.catch(function(e){if(bubble){bubble.classList.remove("pend");bubble.classList.add("fail")}
if(!ta.value)ta.value=body;err.textContent=e&&e.status===429?t.slow:(e&&e.status===400&&e.message?e.message:t.err)})
.then(function(){busy=false;grow()})}
snd.onclick=submit;
// Enter sends, Shift+Enter adds a line (same as every chat in Yolias).
ta.addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();submit()}});
hBtn.onclick=function(){if(!conv)return;hBtn.disabled=true;err.textContent="";req("/handoff",{method:"POST",body:JSON.stringify({conversation:conv})}).then(function(){state.ai=false;return poll()}).catch(function(){err.textContent=t.humanErr}).then(function(){hBtn.disabled=false})};

/* Tabs */
var tabs=el("div","tabs");tabs.setAttribute("role","tablist");var tabBtns={};
function tab(id,icon,label){var b=el("button","tab");b.type="button";b.setAttribute("role","tab");b.setAttribute("aria-selected","false");b.appendChild(svg(icon,22));b.appendChild(el("span",null,label));b.onclick=function(){show(id);if(id==="messages")loadConversations();if(id==="help")setTimeout(function(){sIn.focus()},60)};tabBtns[id]=b;tabs.appendChild(b)}
tab("home",I.home,t.home);tab("messages",I.msgs,t.messages);if(cfg.help!==false)tab("help",I.help,t.help);
function show(v){view=v;[["home",vHome],["messages",vMsgs],["help",vHelp],["chat",vChat],["art",vArt]].forEach(function(p){p[1].classList.toggle("on",p[0]===v)});
tabs.style.display=v==="chat"||v==="art"?"none":"flex";for(var k in tabBtns){tabBtns[k].setAttribute("aria-selected",k===v?"true":"false")}
if(v==="help"&&!sIn.value)helpIdle()}
m.append(vHome,vMsgs,vHelp,vArt,vChat,tabs);wrap.append(m,btn);show("home");
function toggle(o){openNow=o;wrap.classList.toggle("open",o);btn.setAttribute("aria-expanded",o?"true":"false");
if(o){if(token)req("/conversations").then(function(r){renderRecent(r.conversations||[])}).catch(function(){});if(view==="chat"&&conv)poll();
setTimeout(function(){if(view==="chat")return;var f=m.querySelector(".view.on .card,.view.on input,.view.on .item");if(f)f.focus()},120)}}
btn.onclick=function(){toggle(!openNow)};
root.addEventListener("keydown",function(e){if(e.key==="Escape"&&openNow){toggle(false);if(!HIDDEN)btn.focus()}});
api.open=function(){toggle(true)};api.close=function(){toggle(false)};api.toggle=function(){toggle(!openNow)};
api.newMessage=function(){toggle(true);openChat(null)};api.searchHelp=function(){toggle(true);show("help")};
if(pendingOpen)toggle(true);
try{window.dispatchEvent(new CustomEvent("bos-widget-ready"))}catch(e){}}
var api={open:function(){pendingOpen=true},close:function(){pendingOpen=false},toggle:function(){pendingOpen=!pendingOpen},newMessage:function(){pendingOpen=true},searchHelp:function(){pendingOpen=true}};
window.bosWidget=api;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();})();`;
