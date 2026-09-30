import type { ReactNode } from "react";
import { getPortalUser } from "@/lib/bos/portal-auth";
import { PortalNav } from "./PortalNav";
import { portalSignOutAction } from "./actions";
import "./portal.css";

export const metadata = { title: "بوابة العملاء — Taysonsta", robots: { index: false } };

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const p = await getPortalUser();
  if (!p) return <div className="portal" dir="rtl">{children}</div>;
  return (
    <div className="portal" dir="rtl">
      <div className="portal-shell">
        <aside className="portal-side">
          <div className="portal-brand">Taysonsta<small>{p.clientName}</small></div>
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
