// Currency rule (final spec §54): Egypt → EGP, every other country → USD.
// No other currencies, no exchange rates, no conversion.

export const currencies = ["EGP", "USD"] as const;
export type Currency = (typeof currencies)[number];

const EGYPT = new Set(["eg", "egy", "egypt", "مصر", "جمهورية مصر العربية"]);

export function isEgypt(country: string | null | undefined): boolean {
  return country != null && EGYPT.has(country.trim().toLowerCase());
}

export function currencyForCountry(country: string | null | undefined): Currency {
  return isEgypt(country) ? "EGP" : "USD";
}

export function isCurrency(v: unknown): v is Currency {
  return v === "EGP" || v === "USD";
}

/** Options for a currency select. */
export const currencyOptions = currencies.map((c) => ({ value: c, label: c }));
