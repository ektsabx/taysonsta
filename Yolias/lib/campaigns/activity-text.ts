import { fmt } from "@/lib/i18n/config";

// The activity log (campaign_activity) is written by the worker in English;
// a reader in Arabic sees each line by its kind (D-273), with the number of
// people when the row carries it. English readers see the line as written.
export function activityText(a: { kind: string; body: string; meta?: unknown }, locale: "en" | "ar", act: Record<string, string>): string {
  if (locale === "en") return a.body;
  const line = act[a.kind];
  if (!line) return a.body;
  const n = (a.meta as { added?: number } | null)?.added;
  return fmt(line, { n: String(n ?? "") });
}
