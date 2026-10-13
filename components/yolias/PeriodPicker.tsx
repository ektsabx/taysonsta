import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { DateRangePicker } from "@/components/bos/FilterBar";

// 7 / 30 / 90 days or a custom range (?range= or ?from=&to=), shared by the
// Users and Conversions overviews (D-214).
export function PeriodPicker({ base, sp }: { base: string; sp: Record<string, string> }) {
  const custom = Boolean(sp.from);
  const range = custom ? null : [7, 30, 90].includes(Number(sp.range)) ? Number(sp.range) : 30;
  const keep = Object.fromEntries(Object.entries(sp).filter(([k]) => !["range", "from", "to", "page"].includes(k)));
  return (
    <div className="bos-row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
      {[7, 30, 90].map((d) => (
        <Link key={d} href={`${base}?${new URLSearchParams({ ...keep, range: String(d) })}`} className={`admin-btn small${range === d ? "" : " ghost"}`} aria-current={range === d ? "page" : undefined}>
          <Tx vars={{ n: d }}>{"آخر {n} يومًا"}</Tx>
        </Link>
      ))}
      <DateRangePicker label="فترة مخصصة" />
    </div>
  );
}
