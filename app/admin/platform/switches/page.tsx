import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, StatusBadge } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { ydb } from "@/lib/yolias/db";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { SWITCHES, getSwitches } from "@/services/yolias/switches";
import { SwitchForm } from "./SwitchForm";

// Turn parts of Yolias on and off (owner brief 2026-10-13, D-213). Off =
// hidden from customers and refused by the Yolias server within ~15 seconds.
// Other on/off settings that already live on their own pages are listed with
// their current state and a link, so there is one place to look.
export default async function SwitchesPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="تشغيل وإيقاف الخدمات" /><NotConnected /></>);
  const manage = can(bos, "platform.manage", "all");
  const [{ values, updatedAt }, program, widget, packs] = await Promise.all([
    getSwitches(),
    ydb().rpc("affiliate_settings").then((r) => (r.data?.[0]?.settings as { enabled?: boolean } | undefined)?.enabled ?? false),
    ydb().from("site_settings").select("value").eq("key", "support_widget").maybeSingle().then((r) => Boolean((r.data?.value as { key?: string } | null)?.key)),
    ydb().from("prospect_packs").select("id", { count: "exact", head: true }).eq("active", true).then((r) => r.count ?? 0),
  ]);
  const badge = (on: boolean) => (on ? <StatusBadge tone="success" label="يعمل" /> : <StatusBadge tone="neutral" label="متوقف" />);
  return (
    <>
      <PageHeader title="تشغيل وإيقاف الخدمات" subtitle="شغّل أو أوقف أي جزء في Yolias في أي وقت. الإيقاف يخفيه عن العملاء ويرفضه الخادم أيضًا، ويظهر من جديد عند التشغيل." />
      <Card title="بوابات الدفع والشراء">
        <div className="bos-table-scroll"><table className="bos-table">
          <tbody>
            {SWITCHES.map((s) => (
              <tr key={s.key}>
                <td><strong><Tx>{s.label}</Tx></strong><span className="cell-sub"><Tx>{s.hint}</Tx></span></td>
                <td>{badge(values[s.key])}</td>
                <td>{manage ? <SwitchForm k={s.key} on={values[s.key]} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <p className="bos-faint" style={{ fontSize: 12 }}>
          <Tx>يطبَّق خلال 15 ثانية تقريبًا. كل تغيير يُسجَّل في سجل التدقيق.</Tx>{updatedAt ? <> · <Tx vars={{ d: formatDateTime(updatedAt) }}>{"آخر تغيير {d}"}</Tx></> : null}
          {" "}<Tx>إذا أوقفت كل طرق الدفع تظهر صفحة الدفع برسالة «الاشتراك غير متاح حاليًا».</Tx>
        </p>
      </Card>
      <Card title="إعدادات تشغيل أخرى (لكل منها صفحتها)">
        <div className="bos-table-scroll"><table className="bos-table">
          <tbody>
            <tr><td><Tx>برنامج الشركاء (Yolias Partners): الانضمام الجديد</Tx></td><td>{badge(program)}</td><td><Link className="bos-link" href="/admin/affiliates/settings"><Tx>إعدادات البرنامج</Tx></Link></td></tr>
            <tr><td><Tx>ويدجت الدعم على yolias.com</Tx></td><td>{badge(widget)}</td><td><Link className="bos-link" href="/admin/support/widgets"><Tx>ويدجت الدعم</Tx></Link></td></tr>
            <tr><td><Tx>باقات العملاء المحتملين المعروضة</Tx></td><td>{badge(packs > 0)}</td><td><Link className="bos-link" href="/admin/platform/payments"><Tx>الباقات</Tx></Link></td></tr>
            <tr><td><Tx>رسائل البريد والإشعارات لكل حدث</Tx></td><td /><td><Link className="bos-link" href="/admin/platform/emails"><Tx>رسائل البريد</Tx></Link></td></tr>
            <tr><td><Tx>مزودو البيانات</Tx></td><td /><td><Link className="bos-link" href="/admin/platform/providers"><Tx>المزودون</Tx></Link></td></tr>
          </tbody>
        </table></div>
      </Card>
    </>
  );
}
