import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { getBosSession, can, pageRules } from "@/lib/bos/auth";
import { pageAllowed } from "@/lib/bos/page-access";
import { navigationFor } from "@/lib/bos/nav";
import { db } from "@/lib/bos/db";
import { getClockState, touchLastActivity } from "@/services/bos/attendance";
import { AdminChrome } from "@/components/admin/AdminChrome";
import { COLLAPSE_COOKIE } from "@/lib/admin/sidebar";
import { getSystemTime } from "@/lib/bos/system-time";
import { getUiPrefs } from "@/lib/bos/i18n/server";
import { I18nProvider } from "@/components/bos/I18n";
import type { Metadata } from "next";
import "./admin.css";
import "./bos.css";
import "./yolias.css";

// Yolias Admin: the BOS runs on the Yolias design system (app/admin/yolias.css)
// with a fixed identity, so company branding colours/fonts no longer apply here.
export const metadata: Metadata = {
  title: { default: "Yolias Admin", template: "%s — Yolias Admin" },
  icons: { icon: "/assets/brand/yolias-mark.png", apple: "/assets/brand/yolias-mark.png" },
};

const YOLIAS_FONTS = "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Noto+Kufi+Arabic:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,600&display=swap";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [session, ui] = await Promise.all([getBosSession(), getUiPrefs()]);
  const fontLink = <link rel="stylesheet" href={YOLIAS_FONTS} precedence="default" />;

  // Login, reset-password and forbidden pages render without the chrome.
  if (session.status !== "ok") {
    return (
      <I18nProvider locale={ui.locale}>
        {fontLink}
        <div className="admin-shell" dir={ui.dir} lang={ui.locale} data-theme={ui.theme}>{children}</div>
      </I18nProvider>
    );
  }

  const bos = session.bos;
  const collapsed = (await cookies()).get(COLLAPSE_COOKIE)?.value === "1";
  const [{ count: unread }, clockState, systemTime, rules] = await Promise.all([
    db().from("bos_notifications").select("id", { count: "exact", head: true }).eq("user_id", bos.userId).is("read_at", null),
    can(bos, "attendance.create") ? getClockState(bos) : Promise.resolve(null),
    getSystemTime(),
    pageRules(),
    touchLastActivity(bos),
  ]);

  return (
    <I18nProvider locale={ui.locale}>
    {fontLink}
    <div className="admin-shell" dir={ui.dir} lang={ui.locale} data-theme={ui.theme}>
      <AdminChrome
        name={bos.employee.full_name}
        ui={{ locale: ui.locale, theme: ui.theme }}
        email={bos.email}
        roleNames={bos.roleNames}
        navigation={navigationFor(bos)
          .map((g) => ({ ...g, items: g.items?.filter((i) => pageAllowed(rules, i.href, bos.roleKeys, bos.isSuperAdmin)).map((i) => ({ ...i, children: i.children?.filter((c) => pageAllowed(rules, c.href, bos.roleKeys, bos.isSuperAdmin)) })) }))
          .filter((g) => (g.href ? pageAllowed(rules, g.href, bos.roleKeys, bos.isSuperAdmin) : (g.items?.length ?? 0) > 0))}
        unreadNotifications={unread ?? 0}
        initialCollapsed={collapsed}
        systemTime={{ ms: systemTime.ms, timezone: systemTime.timezone }}
        clock={
          clockState
            ? {
                clockInAt: clockState.clockInAt,
                onBreak: clockState.onBreak,
                staleOpenSession: clockState.staleOpenSession,
                workedMinutesToday: clockState.record?.worked_minutes ?? 0,
              }
            : null
        }
      >
        {children}
      </AdminChrome>
    </div>
    </I18nProvider>
  );
}
