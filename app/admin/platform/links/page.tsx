import { requirePermission } from "@/lib/bos/auth";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { Panel } from "@/components/yolias/dash/Stat";
import { SortTable } from "@/components/yolias/dash/SortTable";
import { DashToolbar } from "@/components/yolias/dash/Toolbar";
import { periodOf } from "@/components/yolias/dash/period";
import { utmLinks } from "@/services/yolias/utm-links";
import { LinkBuilder } from "./LinkBuilder";

// Links and their results (owner, 2026-11-10): which shared link brought visits,
// accounts, checkouts and paying customers.
export default async function LinksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("platform.read");
  if (!connected()) return <NotConnected />;
  const p = periodOf(await searchParams);
  const rows = await utmLinks(p.since, p.until);
  const cols = [
    { key: "visitors", label: "الزوار", bar: true }, { key: "signups", label: "التسجيلات" }, { key: "checkouts", label: "فتحوا الدفع" },
    { key: "paid", label: "دفعوا" }, { key: "revenue", label: "الإيرادات", format: "usd" as const },
  ];
  return (
    <div className="yd">
      <div className="yd-head"><h1><Tx>الروابط والمصادر</Tx></h1><DashToolbar preset={p.preset} from={p.from} to={p.to} filters={[]} /></div>
      <Panel title="نتائج كل رابط">
        <SortTable firstLabel="الرابط (المصدر · الوسيلة · الحملة)" initial="visitors" cols={cols}
          rows={rows.map((r) => ({ id: r.key, label: <span dir="ltr">{[r.source, r.medium, r.campaign].filter(Boolean).join(" · ")}</span>, sortLabel: r.key, values: { visitors: r.visitors, signups: r.signups, checkouts: r.checkouts, paid: r.paid, revenue: r.revenue } }))} />
      </Panel>
      <Panel title="اصنع رابطًا"><LinkBuilder /></Panel>
    </div>
  );
}
