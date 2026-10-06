import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card, KpiCard, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { profitability } from "@/services/yolias/health";
import { NotConnected, connected, num, PlanBadge } from "@/components/yolias/PlatformUi";

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
const money = (n: number, c: "USD" | "EGP") => (c === "USD" ? usd(n) : `EGP ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

// Revenue vs platform cost per plan and per workspace, this month (docs/09 §B,
// docs/06). Live revenue only counts real payments; test-mode revenue is
// shown apart and never added to the margin. Revenue stays in its currency
// (USD / EGP, never converted); costs are in USD, so margins are USD-only.
export default async function ProfitabilityPage() {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="الربحية" /><NotConnected /></>);
  const p = await profitability();
  const total = p.totals;
  return (
    <>
      <PageHeader title="الربحية" subtitle="الإيراد مقابل تكلفة المنصة هذا الشهر — الإيراد التجريبي منفصل ولا يدخل في الهامش" />
      <div className="bos-kpis">
        <KpiCard label="إيراد حقيقي (USD)" value={usd(total.live.USD)} />
        <KpiCard label="إيراد حقيقي (EGP)" value={money(total.live.EGP, "EGP")} />
        <KpiCard label="ARPA (USD)" value={total.arpa.USD == null ? "—" : usd(total.arpa.USD)} sub={<Tx vars={{ n: num(total.paying.USD) }}>{"{n} مساحة عمل تدفع"}</Tx>} />
        <KpiCard label="ARPA (EGP)" value={total.arpa.EGP == null ? "—" : money(total.arpa.EGP, "EGP")} sub={<Tx vars={{ n: num(total.paying.EGP) }}>{"{n} مساحة عمل تدفع"}</Tx>} />
        <KpiCard label="إيراد تجريبي" value={`${usd(total.test.USD)} · ${money(total.test.EGP, "EGP")}`} sub={<Tx>ليس مالاً حقيقياً</Tx>} />
        <KpiCard label="التكلفة" value={usd(total.cost)} sub={total.unpriced ? <Tx vars={{ n: num(total.unpriced) }}>{"+ {n} طلب غير مسعّر"}</Tx> : undefined} />
        <KpiCard label="الهامش (مساحات العمل بالدولار)" value={usd(total.marginUsd)} sub={<Tx vars={{ n: num(total.prospects) }}>{"{n} عميل محتمل مسلَّم"}</Tx>} />
      </div>

      <Card title="حسب الخطة">
        {p.byPlan.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الخطة</Tx></th><th><Tx>مساحات العمل</Tx></th><th><Tx>إيراد حقيقي</Tx></th><th><Tx>إيراد تجريبي</Tx></th><th><Tx>التكلفة</Tx></th><th><Tx>العملاء المحتملون المسلَّمون</Tx></th><th><Tx>تكلفة العميل المحتمل</Tx></th></tr></thead>
            <tbody>
              {p.byPlan.map((r) => (
                <tr key={`${r.plan}:${r.currency}`}>
                  <td><PlanBadge plan={r.plan} /> <span className="cell-sub">{r.currency}</span></td>
                  <td className="bos-num">{num(r.workspaces)}</td>
                  <td className="bos-num">{money(r.revenue_live, r.currency)}</td>
                  <td className="bos-num">{money(r.revenue_test, r.currency)}</td>
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
                <tr key={`${r.workspace_id}:${r.currency}`}>
                  <td><Link className="bos-link" href={`/admin/platform/workspaces/${r.workspace_id}`}>{r.name || "—"}</Link></td>
                  <td><PlanBadge plan={r.plan} /></td>
                  <td className="bos-num">{money(r.revenue_live, r.currency)}</td>
                  <td className="bos-num">{money(r.revenue_test, r.currency)}</td>
                  <td className="bos-num">{usd(r.cost)}{r.unpriced_calls ? <span className="cell-sub"><Tx vars={{ n: num(r.unpriced_calls) }}>{"+ {n} طلب غير مسعّر"}</Tx></span> : null}</td>
                  <td className="bos-num">{r.margin == null ? "—" : usd(r.margin)}</td>
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
