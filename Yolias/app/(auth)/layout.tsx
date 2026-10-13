import { BrandLogo } from "@/components/BrandLogo";
import { LanguageMenu } from "@/components/LanguageMenu";
import type { Metadata as NoindexMetadata } from "next";
import { noindex } from "@/lib/seo";

// Never in search results (D-179): private, per-user pages.
export const metadata: NoindexMetadata = { robots: noindex };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-brand"><BrandLogo /><LanguageMenu /></div>
      <main className="auth-card">{children}</main>
    </div>
  );
}
