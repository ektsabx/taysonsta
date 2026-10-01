import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card, KpiCard, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { yoliasSiteUrl } from "@/lib/yolias/db";
import { yoliasPlans, type YoliasPlan } from "@/lib/yolias/plans";
import { platformOverview } from "@/services/yolias/platform";
import { NotConnected, connected, num, usd, CampaignStatus } from "@/components/yolias/PlatformUi";

// Yolias platform overview (docs/09-yolias-admin.md "Admin analytics"):
// only metrics with a real data source. Revenue is split into live and
// test mode — test-mode plans are not revenue.
export default async function PlatformOverviewPage() {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="منصة Yolias" /><NotConnected /></>);
  const o = await platformOverview();
  const plans = Object.keys(yoliasPlans) as YoliasPlan[];
  const totalWs = Math.max(1, o.workspaces);
  return (
    <>
      <PageHeader
        title="منصة Yolias"
        subtitle="مستخدمو تطبيق Yolias ومساحات العمل والاستخدام — من قاعدة بيانات Yolias مباشرة"
        actions={<a className="admin-btn small secondary" href={yoliasSiteUrl()} target="_blank" rel="noreferrer"><Tx>فتح Yolias</Tx></a>}
      />
      <div className="bos-kpis">
        <KpiCard label="المستخدمون" value={num(o.users)} sub={<Tx vars={{ n: num(o.users30) }}>{"{n} جديد خلال 30 يوماً"}</Tx>} href="/admin/platform/users" />
        <KpiCard label="مساحات العمل" value={num(o.workspaces)} href="/admin/platform/workspaces" />
        <KpiCard label="خطط مدفوعة (فعلية)" value={num(o.livePaid)} sub={<Tx vars={{ n: num(o.testPaid) }}>{"{n} في وضع الاختبار"}</Tx>} />
        <KpiCard label="الإيراد الشهري المتكرر" value={usd(o.mrrLive)} sub={<Tx vars={{ v: usd(o.mrrTest) }}>{"{v} في وضع الاختبار (ليس إيراداً)"}</Tx>} />
        <KpiCard label="عمليات البحث" value={num(o.searches)} sub={<Tx vars={{ n: num(o.searches30) }}>{"{n} خلال 30 يوماً"}</Tx>} href="/admin/platform/searches" />
        <KpiCard label="العملاء المحتملون المسلَّمون" value={num(o.prospects)} sub={<Tx vars={{ n: num(o.prospectsMonth) }}>{"{n} هذا الشهر"}</Tx>} />
      </div>

      <div className="bos-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginTop: 16 }}>
        <Card title="توزيع الخطط">
          <div className="bos-table-scroll">
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الخطة</Tx></th><th><Tx>حصة العملاء المحتملين</Tx></th><th><Tx>مساحات العمل</Tx></th><th>%</th></tr></thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p}>
                  <td>{yoliasPlans[p].label}<span className="cell-sub bos-num">{usd(yoliasPlans[p].priceUsd)}</span></td>
                  <td className="bos-num">{num(yoliasPlans[p].prospects)}</td>
                  <td className="bos-num">{num(o.plans[p] ?? 0)}</td>
                  <td className="bos-num">{Math.round(((o.plans[p] ?? 0) / totalWs) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
          </div>
        </Card>

        <Card title="الحملات حسب الحالة">
          {o.campaignsTotal ? (
            <BosTable className="bos-table">
              <thead><tr><th><Tx>الحالة</Tx></th><th><Tx>العدد</Tx></th></tr></thead>
              <tbody>
                {Object.entries(o.campaigns).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
                  <tr key={s}><td><CampaignStatus value={s} /></td><td className="bos-num">{num(n)}</td></tr>
                ))}
              </tbody>
            </BosTable>
          ) : <EmptyState title="لا توجد حملات بعد" />}
          {o.campaigns.awaiting_source ? (
            <p className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}><Tx>لا يوجد مزود بيانات متصل بعد، لذلك تتوقف الحملات عند «بانتظار مصدر بيانات».</Tx></p>
          ) : null}
        </Card>
      </div>

      <Card title="أحدث المستخدمين" actions={<Link className="bos-link" href="/admin/platform/users"><Tx>عرض الكل</Tx></Link>}>
        {o.recentUsers.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الاسم</Tx></th><th><Tx>البريد الإلكتروني</Tx></th><th><Tx>تاريخ التسجيل</Tx></th></tr></thead>
            <tbody>
              {o.recentUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.workspace_id ? <Link className="bos-link" href={`/admin/platform/workspaces/${u.workspace_id}`}>{u.full_name || "—"}</Link> : u.full_name || "—"}</td>
                  <td dir="ltr">{u.email}</td>
                  <td>{formatDateTime(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا يوجد مستخدمون بعد" />}
      </Card>
    </>
  );
}
