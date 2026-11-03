// Number formats for Yolias Admin's dashboard (D-276). A value that can't be
// worked out is null and shows as "—", never as 0.

export type Fmt = "num" | "usd" | "pct" | "months" | "x";

export function fmtValue(v: number | null | undefined, f: Fmt): string {
  if (v == null || !Number.isFinite(v)) return "—";
  switch (f) {
    case "usd": {
      const abs = Math.abs(v);
      const s = abs >= 100_000 ? `${(v / 1000).toFixed(abs >= 1_000_000 ? 0 : 1)}k` : new Intl.NumberFormat("en-US", { maximumFractionDigits: abs < 100 ? 2 : 0 }).format(v);
      return v < 0 ? `-$${s.replace("-", "")}` : `$${s}`;
    }
    case "pct": return `${(v * 100).toFixed(Math.abs(v) < 0.1 ? 1 : 0)}%`;
    case "months": return `${v.toFixed(v < 10 ? 1 : 0)}`;
    case "x": return `${v.toFixed(1)}×`;
    default: return new Intl.NumberFormat("en-US", { maximumFractionDigits: v % 1 ? 1 : 0 }).format(v);
  }
}

export const compact = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (a >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(v * 100) / 100);
};
