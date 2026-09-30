import type { ReactNode } from "react";
import { getBosSession, can, pageRules } from "@/lib/bos/auth";
import { pageAllowed } from "@/lib/bos/page-access";
import { navigationFor } from "@/lib/bos/nav";
import { db } from "@/lib/bos/db";
import { getClockState, touchLastActivity } from "@/services/bos/attendance";
import { AdminChrome } from "@/components/admin/AdminChrome";
import { getSystemTime } from "@/lib/bos/system-time";
import { currentBranchSelection } from "@/lib/bos/branch";
import { getUiPrefs } from "@/lib/bos/i18n/server";
import { I18nProvider } from "@/components/bos/I18n";
import "./admin.css";
import "./bos.css";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [session, ui] = await Promise.all([getBosSession(), getUiPrefs()]);

  // Login, reset-password and forbidden pages render without the chrome.
  if (session.status !== "ok") {
    return (
      <I18nProvider locale={ui.locale}>
        <div className="admin-shell" dir={ui.dir} lang={ui.locale} data-theme={ui.theme}>{children}</div>
      </I18nProvider>
    );
  }

  const bos = session.bos;
  const [{ count: unread }, clockState, systemTime, branchSel, rules] = await Promise.all([
    db().from("notifications").select("id", { count: "exact", head: true }).eq("user_id", bos.userId).is("read_at", null),
    can(bos, "attendance.create") ? getClockState(bos) : Promise.resolve(null),
    getSystemTime(),
    currentBranchSelection(bos),
    pageRules(),
    touchLastActivity(bos),
  ]);

  return (
    <I18nProvider locale={ui.locale}>
    <div className="admin-shell" dir={ui.dir} lang={ui.locale} data-theme={ui.theme}>
      <AdminChrome
        name={bos.employee.full_name}
        ui={{ locale: ui.locale, theme: ui.theme }}
        email={bos.email}
        roleNames={bos.roleNames}
        navigation={navigationFor(bos)
          .map((g) => ({ ...g, items: g.items?.filter((i) => pageAllowed(rules, i.href, bos.roleKeys, bos.isSuperAdmin)) }))
          .filter((g) => (g.href ? pageAllowed(rules, g.href, bos.roleKeys, bos.isSuperAdmin) : (g.items?.length ?? 0) > 0))}
        unreadNotifications={unread ?? 0}
        systemTime={{ ms: systemTime.ms, timezone: systemTime.timezone }}
        branches={{ items: branchSel.branches.map((b) => ({ id: b.id, name: ui.locale === "en" && b.name_en ? b.name_en : b.name })), selected: branchSel.selected }}
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
