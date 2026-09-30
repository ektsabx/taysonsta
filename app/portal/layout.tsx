import type { ReactNode } from "react";
import { getPortalUser } from "@/lib/bos/portal-auth";
import { PortalNav } from "./PortalNav";
import { portalSignOutAction } from "./actions";
import { getSetting } from "@/lib/bos/settings";
import { brandFontHref, onColor } from "@/lib/bos/branding";
import type { CSSProperties } from "react";
import "./portal.css";

export const metadata = { title: "بوابة العملاء — Taysonsta", robots: { index: false } };

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const [p, company] = await Promise.all([getPortalUser(), getSetting("company")]);
  // Company branding (docs/bos/35 B3) — the portal keeps its light palette.
  const style = {
    "--p-accent": company.brand_primary,
    "--p-on-accent": onColor(company.brand_primary),
    ...(company.brand_success ? { "--p-success": company.brand_success } : {}),
    ...(company.brand_warning ? { "--p-warning": company.brand_warning } : {}),
    ...(company.brand_danger ? { "--p-danger": company.brand_danger } : {}),
    fontFamily: `"${company.brand_font_ar}", "IBM Plex Sans Arabic", system-ui, sans-serif`,
  } as CSSProperties;
  const fontHref = brandFontHref(company);
  const fontLink = fontHref ? <link rel="stylesheet" href={fontHref} precedence="default" /> : null;
  if (!p) return <div className="portal" dir="rtl" style={style}>{fontLink}{children}</div>;
  return (
    <div className="portal" dir="rtl" style={style}>
      {fontLink}
      <div className="portal-shell">
        <aside className="portal-side">
          <div className="portal-brand">{company.trade_name || company.name}<small>{p.clientName}</small></div>
          <PortalNav permissions={p.permissions} />
          <div style={{ marginTop: "auto", padding: "10px" }} className="portal-muted">
            {p.contactName}
            <form action={portalSignOutAction}><button type="submit" className="portal-btn secondary" style={{ marginTop: 8, width: "100%", justifyContent: "center" }}>تسجيل الخروج</button></form>
          </div>
        </aside>
        <main className="portal-main">{children}</main>
      </div>
    </div>
  );
}
