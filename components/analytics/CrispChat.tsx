import Script from "next/script";

const CRISP_WEBSITE_ID = "26163f0f-b617-4fa0-bfac-b5e8671693e8";

export function CrispChat() {
  return (
    <Script id="crisp-chat" strategy="afterInteractive">
      {`
window.$crisp=[];window.CRISP_WEBSITE_ID="${CRISP_WEBSITE_ID}";(function(){d=document;s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();
      `}
    </Script>
  );
}
