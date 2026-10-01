import type { Metadata } from "next";
import { DM_Sans, Source_Serif_4 } from "next/font/google";
import { getSession } from "@/lib/session";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Yolias — AI Customer Acquisition",
  description: "Autonomous customer discovery. Tell Yolias who you want to sell to.",
};

// Resolves "system" to light/dark before paint (no theme flash).
const themeScript = `(function(){try{var d=document.documentElement;var p=d.getAttribute('data-theme-pref')||'system';var t=p==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;d.setAttribute('data-theme',t);}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const theme = session?.profile.theme ?? "system";
  const textSize = session?.profile.text_size ?? "normal";

  return (
    <html
      lang="en"
      dir="ltr"
      data-theme-pref={theme}
      data-theme={theme === "dark" ? "dark" : "light"}
      data-text-size={textSize}
      className={`${dmSans.variable} ${sourceSerif.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
