// The support widget that runs on a customer's site (docs/bos/30 §10.5),
// Intercom-style messenger (owner request, D-140): round launcher, soft
// rounded panel that grows from the corner, grey agent bubbles and coloured
// visitor bubbles, typing dots, an e-mail card and a pill composer.
// Vanilla JS inside a Shadow DOM — no styles leak either way. All text is
// inserted with textContent, never as HTML.
//
// Script tag options (all optional):
//   data-icon="/brand/logo-mark.png"  launcher + avatar image
//   data-launcher="hidden"             no floating button; open with window.bosWidget.open()
//   data-lang="ar|en"                  interface language (default: widget setting)
// The API base is the script's own address, so a site can serve the widget
// from its own domain through a proxy (Yolias does, D-134).
// __FALLBACK_API__ is replaced by the server. No template literals or "${" in here.
export const WIDGET_JS = String.raw`(function(){if(window.__bosWidget)return;window.__bosWidget=1;
var CS=document.currentScript;
var API=(CS&&CS.src&&CS.src.replace(/\/embed\.js(?:\?.*)?$/,""))||__FALLBACK_API__;
var ICON=CS&&CS.getAttribute("data-icon");if(ICON){try{ICON=new URL(ICON,CS.src).href}catch(e){ICON=null}}
var HIDDEN=CS&&CS.getAttribute("data-launcher")==="hidden";
var LANGQ=CS&&CS.getAttribute("data-lang");
var TK="bos_widget_"+API.split("/").slice(-1)[0];
var L={
ar:{send:"إرسال",ph:"اكتب رسالة…",name:"الاسم",email:"بريدك الإلكتروني",ask:"اترك بريدك لنرد عليك حتى لو أغلقت الصفحة.",ai:"مساعد ذكي",team:"فريق الدعم",close:"إغلاق",err:"تعذّر الإرسال، حاول مرة أخرى.",slow:"أرسلت رسائل كثيرة، انتظر قليلًا.",on:"عادةً نرد خلال دقائق",off:"خارج ساعات العمل — سنرد عبر البريد",open:"افتح المحادثة",you:"أنت",now:"الآن"},
en:{send:"Send",ph:"Message…",name:"Name",email:"Your email",ask:"Leave your email so we can reply even if you close this page.",ai:"AI assistant",team:"Support team",close:"Close",err:"Couldn't send. Please try again.",slow:"Too many messages — please wait a moment.",on:"We typically reply in a few minutes",off:"We're away — we'll reply by email",open:"Open chat",you:"You",now:"Just now"}};
var cfg,t,token=null,since=null,timer=null,seen={},started=false,openNow=false,pendingOpen=false;
try{token=localStorage.getItem(TK)}catch(e){}
function req(p,o){o=o||{};var h={"content-type":"application/json"};if(token)h["x-widget-token"]=token;
return fetch(API+p,{method:o.method||"GET",body:o.body,headers:h,credentials:"omit"}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){
if(r.status===401&&token&&p!=="/session"){token=null;try{localStorage.removeItem(TK)}catch(e){}}
if(!r.ok){var e=new Error(j.error||"error");e.status=r.status;throw e}return j})})}
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function svg(d,size){var s=document.createElementNS("http://www.w3.org/2000/svg","svg");s.setAttribute("viewBox","0 0 24 24");s.setAttribute("width",size||24);s.setAttribute("height",size||24);s.setAttribute("aria-hidden","true");
var p=document.createElementNS("http://www.w3.org/2000/svg","path");p.setAttribute("d",d);p.setAttribute("fill","currentColor");s.appendChild(p);return s}
var I={chat:"M12 3C6.48 3 2 6.92 2 11.75c0 2.43 1.14 4.62 2.97 6.2-.13 1.42-.62 2.73-1.45 3.75 2.1-.1 3.94-.83 5.25-1.88 1 .27 2.08.43 3.23.43 5.52 0 10-3.92 10-8.75S17.52 3 12 3z",
down:"M12 15.4 5.3 8.7a1 1 0 0 1 1.4-1.4L12 12.6l5.3-5.3a1 1 0 1 1 1.4 1.4L12 15.4z",
x:"M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 0 0-1.4 1.4L10.6 12l-4.9 4.9a1 1 0 1 0 1.4 1.4L12 13.4l4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4z",
up:"M12 4.6l6.7 6.7a1 1 0 0 1-1.4 1.4L13 8.4V19a1 1 0 1 1-2 0V8.4l-4.3 4.3a1 1 0 1 1-1.4-1.4L12 4.6z"};
function avatar(cls){var a=el("span",cls||"av");if(ICON){var i=el("img");i.src=ICON;i.alt="";a.appendChild(i)}else{a.appendChild(svg(I.chat,16))}return a}
function init(){req("/config").then(function(c){cfg=c;build()}).catch(function(){})}
function build(){
var lang=LANGQ==="ar"||LANGQ==="en"?LANGQ:cfg.language;t=L[lang]||L.ar;var rtl=lang==="ar";var side=cfg.position==="left"?"left":"right";
var host=el("div");host.setAttribute("data-bos-widget","");host.style.cssText="position:fixed;z-index:2147483000;bottom:0;"+side+":0;width:0;height:0";document.body.appendChild(host);
var root=host.attachShadow({mode:"open"});var C=cfg.color;var B=(cfg.bottom||20);
var css=":host{all:initial}"+
"*{box-sizing:border-box;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Kufi Arabic','Noto Sans Arabic',Tahoma,sans-serif;-webkit-font-smoothing:antialiased}"+
".launcher{position:fixed;bottom:"+B+"px;"+side+":20px;width:48px;height:48px;border-radius:50%;border:0;padding:0;background:"+C+";color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 6px 0 rgba(0,0,0,.06),0 2px 32px 0 rgba(0,0,0,.16);transition:transform .167s cubic-bezier(.33,0,0,1);outline:none}"+
".launcher:hover{transform:scale(1.1)}.launcher:active{transform:scale(.95)}.launcher:focus-visible{box-shadow:0 0 0 3px #fff,0 0 0 5px "+C+"}"+
".launcher .ic{position:absolute;display:flex;transition:transform .16s linear,opacity .08s linear}.launcher .ic img{width:28px;height:28px;object-fit:contain;filter:brightness(0) invert(1)}"+
".launcher .ic.b{opacity:0;transform:rotate(-30deg) scale(.5)}.open .launcher .ic.a{opacity:0;transform:rotate(30deg) scale(.5)}.open .launcher .ic.b{opacity:1;transform:none}"+
".hidden-launcher .launcher{display:none}"+
".m{position:fixed;"+side+":20px;bottom:"+(B+64)+"px;width:400px;height:min(704px,calc(100vh - "+(B+84)+"px));max-height:704px;border-radius:16px;background:#fff;color:#1a1a1a;box-shadow:0 5px 40px rgba(0,0,0,.16);display:flex;flex-direction:column;overflow:hidden;opacity:0;visibility:hidden;transform:translateY(8px) scale(.97);transform-origin:bottom "+side+";transition:opacity .2s ease,transform .3s cubic-bezier(0,1.2,1,1),visibility 0s .3s}"+
".hidden-launcher .m{bottom:"+B+"px;height:min(704px,calc(100vh - "+(B+20)+"px))}"+
".open .m{opacity:1;visibility:visible;transform:none;transition:opacity .2s ease,transform .3s cubic-bezier(0,1.2,1,1),visibility 0s}"+
".hd{display:flex;align-items:center;gap:12px;padding:16px 16px 14px 20px;border-bottom:1px solid #f0f0f0;background:#fff}"+
".av{flex:none;width:32px;height:32px;border-radius:50%;background:#fff;border:1px solid #ececec;display:flex;align-items:center;justify-content:center;overflow:hidden;color:"+C+"}.av img{width:20px;height:20px;object-fit:contain}"+
".hd .av{width:40px;height:40px}.hd .av img{width:26px;height:26px}"+
".ht{flex:1;min-width:0}.ht b{display:block;font-size:16px;font-weight:600;line-height:1.3;color:#1a1a1a}.ht small{display:flex;align-items:center;gap:6px;font-size:13px;color:#737376;line-height:1.4;margin-top:1px}"+
".dot{width:8px;height:8px;border-radius:50%;background:#2ec27e;flex:none}.dot.off{background:#c4c4c8}"+
".x{flex:none;width:32px;height:32px;border-radius:8px;border:0;background:transparent;color:#737376;cursor:pointer;display:flex;align-items:center;justify-content:center}.x:hover{background:#f2f3f5;color:#1a1a1a}"+
".list{flex:1;overflow-y:auto;padding:20px 20px 8px;display:flex;flex-direction:column;gap:4px;scroll-behavior:smooth;overscroll-behavior:contain}"+
".row{display:flex;align-items:flex-end;gap:8px;max-width:100%}.row.me{justify-content:flex-end}.row .av{width:24px;height:24px;margin-bottom:18px}.row .av img{width:15px;height:15px}"+
".col{display:flex;flex-direction:column;max-width:78%}.me .col{align-items:flex-end}"+
".bub{padding:12px 16px;border-radius:20px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere}"+
".them .bub{background:#f2f3f5;color:#1a1a1a;border-end-start-radius:6px}.me .bub{background:"+C+";color:#fff;border-end-end-radius:6px}"+
".meta{font-size:12px;color:#9a9aa0;padding:4px 4px 10px}"+
".typing{display:none}.typing.on{display:flex}.dots{display:flex;gap:4px;padding:16px}.dots i{width:6px;height:6px;border-radius:50%;background:#9a9aa0;animation:bw 1.2s infinite ease-in-out}.dots i:nth-child(2){animation-delay:.15s}.dots i:nth-child(3){animation-delay:.3s}"+
"@keyframes bw{0%,60%,100%{opacity:.35;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}"+
".card{margin:4px 0 12px;padding:14px;border:1px solid #ececec;border-radius:12px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.04);display:flex;flex-direction:column;gap:8px}.card p{font-size:13px;color:#737376;line-height:1.45}"+
"input{width:100%;height:40px;border:1px solid #e3e3e6;border-radius:8px;padding:0 12px;font-size:14px;color:#1a1a1a;background:#fff;outline:none;transition:border-color .15s}input:focus{border-color:"+C+"}"+
".ft{padding:8px 16px 16px}.box{display:flex;align-items:flex-end;gap:8px;border:1px solid #e3e3e6;border-radius:24px;padding:6px 6px 6px 16px;background:#fff;transition:border-color .15s,box-shadow .15s}.box:focus-within{border-color:#c9c9ce;box-shadow:0 2px 8px rgba(0,0,0,.06)}"+
"textarea{flex:1;min-width:0;border:0;outline:none;resize:none;font-size:14px;line-height:20px;max-height:120px;padding:8px 0;color:#1a1a1a;background:transparent}textarea::placeholder,input::placeholder{color:#9a9aa0}"+
".send{flex:none;width:36px;height:36px;border-radius:50%;border:0;background:#f2f3f5;color:#9a9aa0;cursor:default;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s,transform .1s}"+
".send.ready{background:"+C+";color:#fff;cursor:pointer}.send.ready:active{transform:scale(.92)}"+
".err{font-size:12px;color:#d0342c;padding:0 8px 6px}"+
"@media (max-width:450px){.m{"+side+":0;bottom:0;width:100vw;height:100%;max-height:none;border-radius:0}.open .launcher{display:none}}"+
"@media (prefers-reduced-motion:reduce){.m,.launcher,.launcher .ic{transition:none}.dots i{animation:none}}";
var st=el("style");st.textContent=css;root.appendChild(st);
var wrap=el("div",HIDDEN?"hidden-launcher":"");wrap.dir=rtl?"rtl":"ltr";root.appendChild(wrap);
var btn=el("button","launcher");btn.type="button";btn.setAttribute("aria-label",t.open);
var ia=el("span","ic a");if(ICON){var li=el("img");li.src=ICON;li.alt="";ia.appendChild(li)}else{ia.appendChild(svg(I.chat,28))}
var ib=el("span","ic b");ib.appendChild(svg(I.down,28));btn.append(ia,ib);
var m=el("div","m");m.setAttribute("role","dialog");m.setAttribute("aria-label",cfg.title);
var hd=el("div","hd");var ht=el("div","ht");ht.appendChild(el("b",null,cfg.title));var sub=el("small");var dot=el("span","dot"+(cfg.online?"":" off"));sub.append(dot,document.createTextNode(cfg.online?(cfg.ai?t.ai+" · "+t.on:t.on):t.off));ht.appendChild(sub);
var x=el("button","x");x.type="button";x.setAttribute("aria-label",t.close);x.appendChild(svg(I.x,20));hd.append(avatar(),ht,x);
var list=el("div","list");list.setAttribute("aria-live","polite");
var typing=el("div","row them typing");var tc=el("div","col");var tb=el("div","bub dots");tb.append(el("i"),el("i"),el("i"));tc.appendChild(tb);typing.append(avatar(),tc);
var ft=el("div","ft");var err=el("div","err");var box=el("div","box");var ta=el("textarea");ta.rows=1;ta.placeholder=t.ph;ta.maxLength=4000;ta.setAttribute("aria-label",t.ph);
var send=el("button","send");send.type="button";send.setAttribute("aria-label",t.send);send.appendChild(svg(I.up,20));box.append(ta,send);ft.append(err,box);
m.append(hd,list,ft);wrap.append(m,btn);
var last=null;
function add(from,body){var me=from==="me";var r=el("div","row "+(me?"me":"them"));var c=el("div","col");c.appendChild(el("div","bub",body));
if(!me&&last!=="them"){r.appendChild(avatar())}else if(!me){var sp=el("span");sp.style.cssText="width:24px;flex:none";r.appendChild(sp)}
r.appendChild(c);list.insertBefore(r,card&&card.parentNode===list?card:typing.parentNode===list?typing:null);last=me?"me":"them";
var prev=list.querySelectorAll(".meta");for(var i=0;i<prev.length;i++)prev[i].remove();
c.appendChild(el("div","meta",(me?t.you:(from==="ai"?t.ai:t.team))+" · "+t.now));list.scrollTop=list.scrollHeight}
list.appendChild(typing);
add("agent",cfg.online?cfg.welcome:cfg.offline);
var card=null,nameI=null,emailI=null;
if(!token){card=el("div","card");card.appendChild(el("p",null,t.ask));nameI=el("input");nameI.placeholder=t.name;nameI.maxLength=120;nameI.autocomplete="name";emailI=el("input");emailI.type="email";emailI.placeholder=t.email;emailI.maxLength=200;emailI.autocomplete="email";card.append(nameI,emailI);list.insertBefore(card,typing)}
function grow(){ta.style.height="auto";ta.style.height=Math.min(ta.scrollHeight,120)+"px";send.classList.toggle("ready",!!ta.value.trim())}
ta.addEventListener("input",grow);
function showTyping(on){typing.classList.toggle("on",!!on);if(on)list.scrollTop=list.scrollHeight}
function poll(){if(!token)return Promise.resolve();return req("/messages"+(since?"?since="+encodeURIComponent(since):"")).then(function(r){
for(var i=0;i<r.messages.length;i++){var mm=r.messages[i];if(seen[mm.id])continue;seen[mm.id]=1;since=mm.at;add(mm.from,mm.body)}
var lm=r.messages.length?r.messages[r.messages.length-1]:null;showTyping(r.ai&&lm&&lm.from==="me")}).catch(function(){})}
var busy=false;
function submit(){err.textContent="";var body=ta.value.trim();if(!body||busy)return;
if(card&&cfg.requireEmail&&!emailI.value.trim()){emailI.focus();return}
busy=true;send.classList.remove("ready");
var go=token?Promise.resolve():req("/session",{method:"POST",body:JSON.stringify({page:location.href})}).then(function(s){token=s.token;try{localStorage.setItem(TK,token)}catch(e){}});
go.then(function(){return req("/messages",{method:"POST",body:JSON.stringify({body:body,name:nameI?nameI.value:"",email:emailI?emailI.value:""})})}).then(function(r){
ta.value="";grow();if(card){card.remove();card=null}if(r.ai)showTyping(true);return poll()}).catch(function(e){err.textContent=e.status===429?t.slow:t.err}).then(function(){busy=false;grow()})}
send.onclick=submit;
// Enter sends, Shift+Enter adds a line (same as every chat in Yolias).
ta.addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();submit()}});
function toggle(o){openNow=o;wrap.classList.toggle("open",o);btn.setAttribute("aria-expanded",o?"true":"false");
if(o){if(!started){started=true;poll()}timer=timer||setInterval(poll,4000);setTimeout(function(){(card&&cfg.requireEmail&&!emailI.value?nameI:ta).focus()},120);list.scrollTop=list.scrollHeight}
else{clearInterval(timer);timer=null}}
btn.onclick=function(){toggle(!openNow)};x.onclick=function(){toggle(false)};
root.addEventListener("keydown",function(e){if(e.key==="Escape"&&openNow)toggle(false)});
api.open=function(){toggle(true)};api.close=function(){toggle(false)};api.toggle=function(){toggle(!openNow)};
if(pendingOpen)toggle(true);
try{window.dispatchEvent(new CustomEvent("bos-widget-ready"))}catch(e){}}
var api={open:function(){pendingOpen=true},close:function(){pendingOpen=false},toggle:function(){pendingOpen=!pendingOpen}};
window.bosWidget=api;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();})();`;
