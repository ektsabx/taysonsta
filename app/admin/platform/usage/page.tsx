import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card, KpiCard, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { usageOverview } from "@/services/yolias/modules";
import { NotConnected, connected, num, PlanBadge } from "@/components/yolias/PlatformUi";

const pct = (v: number) => `${Math.round(v * 100)}%`;

// Usage (final spec phase 9): prospects used this month against allowances,
// by plan and by workspace, plus Buy More Prospects packs sold. Customers
// see prospects only; this is the admin's view of the same ledger.
export default async function UsagePage() {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="الاستخدام" /><NotConnected /></>);
  const u = await usageOverview();
  return (
    <>
      <PageHeader title="الاستخدام" subtitle={`العملاء المحتملون المستخدمون هذا الشهر (${u.period})`} />
      <div className="bos-kpis">
        <KpiCard label="المستخدم" value={num(u.consumed)} sub={<Tx vars={{ n: num(u.allowance) }}>{"من {n}"}</Tx>} />
        <KpiCard label="نسبة الاستخدام" value={u.allowance ? pct(u.consumed / u.allowance) : "—"} />
        <KpiCard label="باقات إضافية مباعة" value={num(u.packs.prospects)} sub={`USD ${num(u.packs.live)}`} href="/admin/platform/payments" />
      </div>
      <Card title="حسب الخطة">
        {u.byPlan.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الخطة</Tx></th><th><Tx>مساحات العمل</Tx></th><th><Tx>المستخدم</Tx></th><th><Tx>المتاح</Tx></th><th><Tx>بلغت الحد</Tx></th></tr></thead>
            <tbody>{u.byPlan.map((p) => (
              <tr key={p.plan}><td><PlanBadge plan={p.plan} /></td><td className="bos-num">{num(p.workspaces)}</td><td className="bos-num">{num(p.consumed)}</td><td className="bos-num">{num(p.allowance)}</td><td className="bos-num">{num(p.atLimit)}</td></tr>
            ))}</tbody>
          </BosTable>
        ) : <EmptyState title="لا يوجد استخدام هذا الشهر" />}
      </Card>
      <Card title="الأعلى استخداماً">
        {u.top.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>مساحة العمل</Tx></th><th><Tx>الخطة</Tx></th><th><Tx>المستخدم</Tx></th><th><Tx>المتاح</Tx></th><th><Tx>النسبة</Tx></th></tr></thead>
            <tbody>{u.top.map((w) => (
              <tr key={w.id}><td><Link className="bos-link" href={`/admin/platform/workspaces/${w.id}`}>{w.name || "—"}</Link></td><td><PlanBadge plan={w.plan} /></td><td className="bos-num">{num(w.consumed)}</td><td className="bos-num">{num(w.allowance)}</td><td className="bos-num">{pct(w.pct)}</td></tr>
            ))}</tbody>
          </BosTable>
        ) : <EmptyState title="لا يوجد استخدام هذا الشهر" />}
      </Card>
    </>
  );
}
