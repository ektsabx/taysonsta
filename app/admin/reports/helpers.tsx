import { formatMoney } from "@/lib/bos/money";
import { isCurrency } from "@/lib/bos/currency";
import { ErrorState } from "@/components/bos/ui";
import { ValidationError } from "@/lib/bos/errors";

// Reports sum one currency (EGP or USD, final spec §54) chosen by the filter.
export const reportCurrency = (sp: Record<string, string | undefined>) => (isCurrency(sp.currency) ? sp.currency : "USD");
export const moneyIn = (sp: Record<string, string | undefined>) => {
  const currency = reportCurrency(sp);
  return (v: unknown) => formatMoney(v, currency);
};
export const num = (v: unknown) => (v == null ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 }));
export const pct = (v: unknown) => (v == null ? "—" : `${Number(v).toFixed(1).replace(/\.0$/, "")}%`);

export async function safeReport<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; node: React.ReactNode }> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, node: <ErrorState title="فلاتر غير صالحة" description={e.message} /> };
    throw e;
  }
}
