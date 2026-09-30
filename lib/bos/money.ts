// Money helpers (§76). Amounts travel as decimal strings and are computed
// as bigint thousandths (3 dp covers KWD), never as JS floats.

const SCALE = 3;
const FACTOR = BigInt(10 ** SCALE);

export const currencyDecimals: Record<string, number> = { KWD: 3 };

export function decimalsFor(currency: string | null | undefined): number {
  return currency ? (currencyDecimals[currency] ?? 2) : 2;
}

export function parseMoney(value: unknown): bigint | null {
  if (value === null || value === undefined || value === "") return null;
  const text = typeof value === "number" ? value.toFixed(SCALE) : String(value).replace(/[,\s]/g, "");
  const match = text.match(/^(-)?(\d+)(?:\.(\d+))?$/);
  if (!match) return null;
  const frac = (match[3] ?? "").padEnd(SCALE + 1, "0");
  let units = BigInt(match[2]) * FACTOR + BigInt(frac.slice(0, SCALE));
  // Half-up rounding on the 4th decimal.
  if (Number(frac[SCALE]) >= 5) units += BigInt(1);
  return match[1] ? -units : units;
}

export function toDecimalString(units: bigint, decimals = 2): string {
  const negative = units < BigInt(0);
  let abs = negative ? -units : units;
  if (decimals < SCALE) {
    const step = BigInt(10 ** (SCALE - decimals));
    const remainder = abs % step;
    abs = abs - remainder + (remainder * BigInt(2) >= step ? step : BigInt(0));
  }
  const whole = abs / FACTOR;
  const frac = (abs % FACTOR).toString().padStart(SCALE, "0").slice(0, decimals);
  return `${negative ? "-" : ""}${whole.toString()}${decimals > 0 ? `.${frac}` : ""}`;
}

export function addMoney(...values: unknown[]): bigint {
  return values.reduce<bigint>((sum, v) => sum + (parseMoney(v) ?? BigInt(0)), BigInt(0));
}

// amount × percent / 100, rounded half-up to the currency's decimals.
export function percentOf(amount: unknown, percent: unknown, currency?: string | null): bigint {
  const a = parseMoney(amount) ?? BigInt(0);
  const p = parseMoney(percent) ?? BigInt(0);
  // a and p are both in thousandths: exact result (thousandths) = a·p / (100·1000).
  const step = BigInt(10 ** (SCALE - decimalsFor(currency)));
  const numerator = a * p;
  const negative = numerator < BigInt(0);
  const n = negative ? -numerator : numerator;
  const denominator = BigInt(100) * FACTOR * step;
  let steps = n / denominator;
  if ((n % denominator) * BigInt(2) >= denominator) steps += BigInt(1);
  const result = steps * step;
  return negative ? -result : result;
}

// Splits a total by percentages; the last row absorbs rounding so the sum
// is exactly the total (matches bos_process_deal_won).
export function allocateByPercent(total: unknown, percents: unknown[], currency?: string | null): bigint[] {
  const t = parseMoney(total) ?? BigInt(0);
  const out: bigint[] = [];
  let allocated = BigInt(0);
  percents.forEach((p, i) => {
    if (i === percents.length - 1) {
      out.push(t - allocated);
    } else {
      const part = percentOf(total, p, currency);
      out.push(part);
      allocated += part;
    }
  });
  return out;
}

export function formatMoney(value: unknown, currency: string | null | undefined, locale = "en-US"): string {
  const units = parseMoney(value);
  if (units === null) return "—";
  const decimals = decimalsFor(currency);
  const text = toDecimalString(units, decimals);
  const [whole, frac] = text.replace("-", "").split(".");
  const grouped = Number(whole).toLocaleString(locale);
  const sign = text.startsWith("-") ? "-" : "";
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : null;
  const amount = `${grouped}${frac && Number(frac) !== 0 ? `.${frac}` : ""}`;
  return symbol ? `${sign}${symbol}${amount}` : `${sign}${amount} ${currency ?? ""}`.trim();
}

export function sumPercents(values: unknown[]): bigint {
  return addMoney(...values);
}

export const HUNDRED_PERCENT = parseMoney("100")!;
