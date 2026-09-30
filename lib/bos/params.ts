export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function readParams(searchParams: SearchParams): Promise<Record<string, string>> {
  const raw = await searchParams;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value !== undefined && value !== "") out[k] = value;
  }
  return out;
}

export function pageOf(params: Record<string, string>): number {
  const n = Number(params.page ?? 1);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function qs(params: Record<string, string | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}
