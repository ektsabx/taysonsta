import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";

// Rows rendered in a table body, for the record summary (docs/bos/35 B5).
type El = ReactElement<{ children?: ReactNode; colSpan?: number }>;

function flat(nodes: ReactNode): El[] {
  const out: El[] = [];
  Children.forEach(nodes, (n) => {
    if (!isValidElement(n)) return;
    const el = n as El;
    if (el.type === Fragment) out.push(...flat(el.props.children));
    else out.push(el);
  });
  return out;
}

function isEmptyRow(row: El): boolean {
  if (row.type !== "tr") return false;
  const cells = flat(row.props.children);
  return cells.length === 1 && Number(cells[0].props.colSpan ?? 1) > 1;
}

export function countRows(children: ReactNode): number {
  let n = 0;
  for (const el of flat(children)) {
    if (el.type === "thead" || el.type === "tfoot" || el.type === "caption" || el.type === "colgroup") continue;
    if (el.type === "tbody") n += flat(el.props.children).filter((r) => !isEmptyRow(r)).length;
    else if (!isEmptyRow(el)) n += 1;
  }
  return n;
}

