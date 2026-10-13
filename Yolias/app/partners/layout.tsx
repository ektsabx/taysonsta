import Link from "next/link";
import type { Metadata } from "next";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageMenu } from "@/components/LanguageMenu";
import { ThemeMenu } from "@/components/ThemeMenu";
import { getDictionary } from "@/lib/i18n/server";
import { partnerUser } from "@/lib/partners";
import { noindex } from "@/lib/seo";
import { partnerSignOut } from "./auth-actions";
import { PartnerAvatar } from "./AffiliateClient";

export const metadata: Metadata = { robots: noindex };

// Yolias Partners (D-206): its own header and sign-in, separate from the app.
export default async function PartnersLayout({ children }: { children: React.ReactNode }) {
  const [t, user] = await Promise.all([getDictionary(), partnerUser()]);
  return (
    <div className="partners-shell">
      <header className="partners-header">
        <Link href="/partners" className="partners-brand" aria-label={t.partners.brand}>
          <BrandLogo />
          <span className="partners-badge">{t.partners.badge}</span>
        </Link>
        <div className="partners-tools">
          <ThemeMenu />
          <LanguageMenu />
          {user && (
            <>
              <Link href="/partners?tab=profile" className="partners-me" aria-label={t.affiliate.profile.title}>
                <PartnerAvatar name={user.name || user.email} url={user.avatarUrl} />
                <span className="partners-me-name">{user.name || user.email}</span>
              </Link>
              <form action={partnerSignOut}><button className="btn-secondary" type="submit">{t.partners.signOut}</button></form>
            </>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
