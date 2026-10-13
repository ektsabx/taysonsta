import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageMenu } from "@/components/LanguageMenu";
import { ThemeMenu } from "@/components/ThemeMenu";
import type { Metadata as NoindexMetadata } from "next";
import { noindex } from "@/lib/seo";

// Never in search results (D-179): private, per-user pages.
export const metadata: NoindexMetadata = { robots: noindex };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-brand"><Link href="/" aria-label="Yolias"><BrandLogo /></Link><span className="auth-brand-tools"><ThemeMenu /><LanguageMenu /></span></div>
      <main className="auth-card">{children}</main>
    </div>
  );
}
