import Script from "next/script";

// Microsoft Clarity (final spec phase 2): session analytics for the whole
// site. Loads only when NEXT_PUBLIC_CLARITY_PROJECT_ID is set — nothing is
// sent anywhere otherwise. Official snippet from clarity.microsoft.com.
export function Clarity() {
  const id = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim();
  if (!id || !/^[a-z0-9]+$/i.test(id)) return null;
  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${JSON.stringify(id)});`}
    </Script>
  );
}
