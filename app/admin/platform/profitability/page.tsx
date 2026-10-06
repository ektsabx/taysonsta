import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card, KpiCard, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { profitability } from "@/services/yolias/health";
import { NotConnected, connected, num, PlanBadge } from "@/components/yolias/PlatformUi";

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

// Revenue vs platform cost per plan and per workspace, this month (docs/09 §B,
// docs/06). Live revenue only counts real payments; test-mode revenue is
// shown apart and never added to the margin. Everything is in USD (D-131).
export default async function ProfitabilityPage() {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="الربحية" /><NotConnected /></>);
  const p = await profitability();
  const total = p.totals;
  return (
    <>
      <PageHeader title="الربحية" subtitle="الإيراد مقابل تكلفة المنصة هذا الشهر — الإيراد التجريبي منفصل ولا يدخل في الهامش" />
      <div className="bos-kpis">
        <KpiCard label="إيراد حقيقي" value={usd(total.live)} />
        <KpiCard label="ARPA" value={total.arpa == null ? "—" : usd(total.arpa)} sub={<Tx vars={{ n: num(total.paying) }}>{"{n} مساحة عمل تدفع"}</Tx>} />
        <KpiCard label="إيراد تجريبي" value={usd(total.test)} sub={<Tx>ليس مالاً حقيقياً</Tx>} />
        <KpiCard label="التكلفة" value={usd(total.cost)} sub={total.unpriced ? <Tx vars={{ n: num(total.unpriced) }}>{"+ {n} طلب غير مسعّر"}</Tx> : undefined} />
        <KpiCard label="الهامش" value={usd(total.margin)} sub={<Tx vars={{ n: num(total.prospects) }}>{"{n} عميل محتمل مسلَّم"}</Tx>} />
      </div>

      <Card title="حسب الخطة">
        {p.byPlan.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الخطة</Tx></th><th><Tx>مساحات العمل</Tx></th><th><Tx>إيراد حقيقي</Tx></th><th><Tx>إيراد تجريبي</Tx></th><th><Tx>التكلفة</Tx></th><th><Tx>العملاء المحتملون المسلَّمون</Tx></th><th><Tx>تكلفة العميل المحتمل</Tx></th></tr></thead>
            <tbody>
              {p.byPlan.map((r) => (
                <tr key={r.plan}>
                  <td><PlanBadge plan={r.plan} /></td>
                  <td className="bos-num">{num(r.workspaces)}</td>
                  <td className="bos-num">{usd(r.revenue_live)}</td>
                  <td className="bos-num">{usd(r.revenue_test)}</td>
                  <td className="bos-num">{usd(r.cost)}</td>
                  <td className="bos-num">{num(r.prospects)}</td>
                  <td className="bos-num">{r.prospects ? usd(r.cost / r.prospects) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد بيانات هذا الشهر" />}
      </Card>

      <Card title="حسب مساحة العمل">
        {p.rows.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>مساحة العمل</Tx></th><th><Tx>الخطة</Tx></th><th><Tx>إيراد حقيقي</Tx></th><th><Tx>إيراد تجريبي</Tx></th><th><Tx>التكلفة</Tx></th><th><Tx>الهامش</Tx></th><th><Tx>تكلفة العميل المحتمل</Tx></th></tr></thead>
            <tbody>
              {p.rows.map((r) => (
                <tr key={r.workspace_id}>
                  <td><Link className="bos-link" href={`/admin/platform/workspaces/${r.workspace_id}`}>{r.name || "—"}</Link></td>
                  <td><PlanBadge plan={r.plan} /></td>
                  <td className="bos-num">{usd(r.revenue_live)}</td>
                  <td className="bos-num">{usd(r.revenue_test)}</td>
                  <td className="bos-num">{usd(r.cost)}{r.unpriced_calls ? <span className="cell-sub"><Tx vars={{ n: num(r.unpriced_calls) }}>{"+ {n} طلب غير مسعّر"}</Tx></span> : null}</td>
                  <td className="bos-num">{usd(r.margin)}</td>
                  <td className="bos-num">{r.costPerProspect == null ? "—" : usd(r.costPerProspect)}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد بيانات هذا الشهر" />}
      </Card>
    </>
  );
}
