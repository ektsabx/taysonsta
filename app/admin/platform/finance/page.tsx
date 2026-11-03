import { requirePermission, can } from "@/lib/bos/auth";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { financeEntries } from "@/services/yolias/growth";
import { Panel } from "@/components/yolias/dash/Stat";
import { fmtValue } from "@/components/yolias/dash/format";
import { CATEGORY_LABEL, DeleteEntry, FinanceForm } from "./FinanceForm";

// Monthly costs (owner, 2026-11-03, D-276): fixed costs and marketing spend
// per channel. The dashboard uses them for profit, margin and CAC.
export default async function FinancePage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return <NotConnected />;
  const rows = await financeEntries(12);
  const months = [...new Set(rows.map((r) => r.month.slice(0, 7)))];
  const canEdit = can(bos, "platform.manage", "all");
  const thisMonth = new Date().toISOString().slice(0, 7);
  return (
    <div className="yd">
      <div className="yd-head"><h1><Tx>المصاريف والتسويق</Tx></h1></div>
      {canEdit && <Panel title="إضافة بند"><FinanceForm month={thisMonth} /></Panel>}
      {months.map((m) => {
        const items = rows.filter((r) => r.month.startsWith(m));
        const total = (k: string) => items.filter((r) => r.kind === k).reduce((s, r) => s + Number(r.amount_usd), 0);
        return (
          <Panel key={m} title={m} actions={<span className="yd-prev" dir="ltr">{fmtValue(total("fixed") + total("marketing"), "usd")}</span>}>
            <div className="yd-table-wrap">
              <table className="yd-table">
                <thead><tr><th><Tx>البند</Tx></th><th><Tx>النوع</Tx></th><th><Tx>المبلغ</Tx></th><th><Tx>ملاحظة</Tx></th>{canEdit && <th />}</tr></thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id}>
                      <th scope="row"><Tx>{CATEGORY_LABEL[r.category] ?? r.category}</Tx></th>
                      <td><Tx>{r.kind === "fixed" ? (r.cogs ? "تكلفة تقديم الخدمة" : "تكلفة ثابتة") : "تسويق"}</Tx></td>
                      <td dir="ltr">{fmtValue(Number(r.amount_usd), "usd")}</td>
                      <td>{r.note ?? ""}</td>
                      {canEdit && <td><DeleteEntry id={r.id} /></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
