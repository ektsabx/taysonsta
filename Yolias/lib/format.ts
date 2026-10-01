export function initials(name: string | null | undefined, fallback = "?"): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatDate(iso: string | Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone }).format(new Date(iso));
}

export function location(city: string | null | undefined, country: string | null | undefined): string {
  const short: Record<string, string> = { SA: "KSA", AE: "UAE", EG: "Egypt", GB: "UK", US: "USA" };
  const c = country ? short[country.toUpperCase()] ?? country.toUpperCase() : "";
  return [city, c].filter(Boolean).join(", ");
}
