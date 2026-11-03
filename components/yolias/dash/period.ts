// The period of a Yolias Admin dashboard URL (D-276): presets or a custom
// range, as [since, until) in UTC. Shared by the server pages and the toolbar.
export const PRESETS = ["today", "7d", "30d", "90d", "mtd", "lm", "ytd", "12m"] as const;
export type Preset = (typeof PRESETS)[number] | "custom";

const DAY = 86_400_000;
/** The period of a dashboard URL: [since, until) in UTC, and its preset. */
export function periodOf(sp: Record<string, string | undefined>, now = new Date()): { preset: Preset; since: string; until: string; from: string; to: string } {
  const day0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const iso = (t: number) => new Date(t).toISOString();
  const d = (t: number) => iso(t).slice(0, 10);
  const r = (sp.range ?? "30d") as Preset;
  const tomorrow = day0 + DAY;
  if (r === "custom" && sp.from && sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) {
    const a = Date.parse(`${sp.from}T00:00:00Z`), b = Date.parse(`${sp.to}T00:00:00Z`) + DAY;
    if (b > a) return { preset: "custom", since: iso(a), until: iso(b), from: sp.from, to: sp.to };
  }
  const m0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const ranges: Record<Exclude<Preset, "custom">, [number, number]> = {
    today: [day0, tomorrow], "7d": [tomorrow - 7 * DAY, tomorrow], "30d": [tomorrow - 30 * DAY, tomorrow], "90d": [tomorrow - 90 * DAY, tomorrow],
    mtd: [m0, tomorrow], lm: [Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1), m0], ytd: [Date.UTC(now.getUTCFullYear(), 0, 1), tomorrow], "12m": [Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate() + 1), tomorrow],
  };
  const key = (PRESETS as readonly string[]).includes(r) ? (r as Exclude<Preset, "custom">) : "30d";
  const [a, b] = ranges[key];
  return { preset: key, since: iso(a), until: iso(b), from: d(a), to: d(b - DAY) };
}
