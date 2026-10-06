import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card, KpiCard, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { riskOverview } from "@/services/yolias/modules";
import { NotConnected, connected, num, PlanBadge } from "@/components/yolias/PlatformUi";

// Risk (final spec phase 9): billing, security, deliverability and
// operational warning signs per workspace, last 30 days. Real events only.
export default async function RiskPage() {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="المخاطر" /><NotConnected /></>);
  const r = await riskOverview(30);
  return (
    <>
      <PageHeader title="المخاطر" subtitle="إشارات تحذير حقيقية لكل مساحة عمل — آخر 30 يوماً" />
      <div className="bos-kpis">
        <KpiCard label="اشتراكات متأخرة الدفع" value={num(r.pastDue.length)} href="#past-due" />
        <KpiCard label="مساحات عمل بإشارات" value={num(r.workspaces.length)} />
        <KpiCard label="محاولات دخول مريبة" value={num(r.suspiciousSignIns)} sub={<Tx vars={{ n: num(r.suspiciousUsers) }}>{"{n} مستخدم"}</Tx>} />
        <KpiCard label="مهام فاشلة بلا معالجة" value={num(r.unresolvedJobs)} href="/admin/platform/jobs" />
      </div>
      <Card title="مساحات العمل حسب درجة المخاطر">
        {r.workspaces.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>مساحة العمل</Tx></th><th><Tx>الدرجة</Tx></th><th><Tx>دفعات فاشلة</Tx></th><th><Tx>استردادات</Tx></th><th><Tx>طلبات مرفوضة للمساعد</Tx></th><th><Tx>رسائل فاشلة</Tx></th><th><Tx>رسائل لمحظورين</Tx></th><th><Tx>حملات فاشلة</Tx></th></tr></thead>
            <tbody>
              {r.workspaces.map((w) => (
                <tr key={w.workspaceId}>
                  <td><Link className="bos-link" href={`/admin/platform/workspaces/${w.workspaceId}`}>{w.name || "—"}</Link></td>
                  <td className="bos-num"><strong>{num(w.score)}</strong></td>
                  <td className="bos-num">{num(w.failedPayments)}</td>
                  <td className="bos-num">{num(w.refunds)}</td>
                  <td className="bos-num">{num(w.denied)}</td>
                  <td className="bos-num">{num(w.outreachFailed)}</td>
                  <td className="bos-num">{num(w.suppressedSends)}</td>
                  <td className="bos-num">{num(w.campaignsFailed)}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد إشارات مخاطر" />}
        <p className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}><Tx>الدرجة = دفعة فاشلة ×3 + استرداد ×2 + رسالة لشخص محظور ×2 + كل إشارة أخرى ×1.</Tx></p>
      </Card>
      <Card title="اشتراكات متأخرة الدفع" id="past-due">
        {r.pastDue.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>مساحة العمل</Tx></th><th><Tx>الخطة</Tx></th><th><Tx>انتهت الفترة</Tx></th><th><Tx>العملة</Tx></th></tr></thead>
            <tbody>{r.pastDue.map((w) => (
              <tr key={w.id}><td><Link className="bos-link" href={`/admin/platform/workspaces/${w.id}`}>{w.name || "—"}</Link></td><td><PlanBadge plan={w.plan} /></td><td>{w.current_period_end ? formatDateTime(w.current_period_end) : "—"}</td><td dir="ltr">{w.billing_currency}</td></tr>
            ))}</tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد اشتراكات متأخرة" />}
      </Card>
    </>
  );
}
