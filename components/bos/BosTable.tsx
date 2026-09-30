import type { TableHTMLAttributes } from "react";
import { countRows } from "@/lib/bos/table-rows";
import { Tx } from "@/components/bos/I18n";

// Plain tables with the record summary footer (docs/bos/35 B5):
// "Show 1 to N from N records". Works in server and client components; the
// count comes from the rendered rows (a lone colSpan "empty" row counts as 0).
// Paginated record lists use DataTable, which shows the page range instead.

export function RecordSummary({ from, to, total }: { from: number; to: number; total: number }) {
  return (
    <span className="bos-record-summary">
      <Tx vars={{ a: from.toLocaleString("en-US"), b: to.toLocaleString("en-US"), c: total.toLocaleString("en-US") }}>{"عرض {a} إلى {b} من {c} سجل"}</Tx>
    </span>
  );
}

export function BosTable({ children, ...rest }: TableHTMLAttributes<HTMLTableElement>) {
  const n = countRows(children);
  return (
    <table {...rest}>
      {children}
      <tfoot className="bos-table-summary-foot">
        <tr>
          <td colSpan={100}>
            <RecordSummary from={n ? 1 : 0} to={n} total={n} />
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
