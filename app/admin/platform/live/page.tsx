import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { getLocale } from "@/lib/bos/i18n/server";
import { Tx } from "@/components/bos/I18n";
import { RelTime } from "@/components/bos/RelTime";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { liveVisitors } from "@/services/yolias/growth";
import { liveSessions } from "@/services/yolias/traffic";
import { Group, Panel, Stat } from "@/components/yolias/dash/Stat";
import { AutoRefresh } from "@/components/yolias/dash/AutoRefresh";

// Who is on Yolias now (owner, 2026-11-03, D-276): every visitor of the last
// 5 minutes on the website and in the app, with country, city, address,
// device, system, browser, channel and how many times they came. Refreshes
// itself every 30 seconds.
const DEVICE: Record<string, string> = { desktop: "كمبيوتر", mobile: "موبايل", tablet: "تابلت" };
const CHANNEL: Record<string, string> = { organic_search: "SEO", ai_assistant: "GEO / AEO", paid_search: "إعلانات مدفوعة", social: "سوشيال ميديا", direct: "مباشر", referral: "إحالة من موقع", email: "بريد", affiliate: "شركاء", unknown: "غير معروف" };

export default async function LivePage() {
  await requirePermission("platform.read");
  if (!connected()) return <NotConnected />;
  const [visitors, sessions, locale] = await Promise.all([liveVisitors(5), liveSessions(5), getLocale()]);
  const region = new Intl.DisplayNames([locale], { type: "region" });
  const country = (c: string | null | undefined) => { if (!c) return "—"; try { return region.of(c) ?? c; } catch { return c; } };
  const inApp = visitors.filter((v) => v.area === "app").length;
  return (
    <div className="yd">
      <AutoRefresh seconds={30} />
      <div className="yd-head"><h1><span className="yd-live-dot" /><Tx>المستخدمون الآن</Tx></h1></div>
      <Group title="آخر 5 دقائق" tone="growth">
        <Stat tone="growth" label="متصلون الآن" value={visitors.length} />
        <Stat tone="growth" label="داخل المنصة" value={inApp} />
        <Stat tone="growth" label="على الموقع" value={visitors.length - inApp} />
        <Stat tone="growth" label="جلسات مسجّلة" value={sessions.length} />
      </Group>
      <Panel title="الزوار">
        <div className="yd-table-wrap">
          <table className="yd-table">
            <thead><tr>{["الزائر", "الصفحة", "الدولة", "المدينة", "IP", "الجهاز", "النظام", "المتصفح", "القناة", "صفحات الزيارة", "مرات الزيارة", "آخر نشاط"].map((h) => <th key={h}><Tx>{h}</Tx></th>)}</tr></thead>
            <tbody>
              {visitors.map((v) => (
                <tr key={v.visitor}>
                  <th scope="row">{v.user_id ? <span className="yd-who"><Link href={`/admin/platform/users/${v.user_id}`}>{v.name ?? v.email}</Link><small dir="ltr">{v.email}</small></span> : <Tx>زائر</Tx>}</th>
                  <td dir="ltr">{v.path}</td>
                  <td>{country(v.country)}</td>
                  <td>{v.city ?? "—"}</td>
                  <td dir="ltr">{v.ip ?? "—"}</td>
                  <td><Tx>{DEVICE[v.device ?? ""] ?? v.device ?? "—"}</Tx></td>
                  <td>{v.os ?? "—"}</td>
                  <td>{v.browser ?? "—"}</td>
                  <td><Tx>{CHANNEL[v.channel ?? "unknown"] ?? v.channel ?? "—"}</Tx></td>
                  <td dir="ltr">{v.views}</td>
                  <td dir="ltr">{v.visits_total}</td>
                  <td><RelTime value={v.last_at} /></td>
                </tr>
              ))}
              {!visitors.length && <tr><td colSpan={12} className="yd-empty"><Tx>لا أحد الآن</Tx></td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="الجلسات المسجّلة داخل المنصة">
        <div className="yd-table-wrap">
          <table className="yd-table">
            <thead><tr>{["المستخدم", "الدولة", "المدينة", "IP", "الجهاز", "النظام", "المتصفح", "بدأت", "آخر نشاط"].map((h) => <th key={h}><Tx>{h}</Tx></th>)}</tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={`${s.user_id}-${s.started_at}`}>
                  <th scope="row"><span className="yd-who"><Link href={`/admin/platform/users/${s.user_id}`}>{s.name ?? s.email ?? s.user_id.slice(0, 8)}</Link><small dir="ltr">{s.email}</small></span></th>
                  <td>{country(s.country)}</td>
                  <td>{s.city ?? "—"}</td>
                  <td dir="ltr">{s.ip ?? "—"}</td>
                  <td><Tx>{DEVICE[s.device ?? ""] ?? s.device ?? "—"}</Tx></td>
                  <td>{s.os ?? "—"}</td>
                  <td>{s.browser ?? "—"}</td>
                  <td><RelTime value={s.started_at} /></td>
                  <td><RelTime value={s.last_seen_at} /></td>
                </tr>
              ))}
              {!sessions.length && <tr><td colSpan={9} className="yd-empty"><Tx>لا أحد الآن</Tx></td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
