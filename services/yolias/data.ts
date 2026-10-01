import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { ValidationError } from "@/lib/bos/errors";
import { yintel } from "@/lib/yolias/db";

// Shared intelligence for Yolias Admin (docs/09 §B "Companies · People",
// "Data sources · Provenance · Freshness", suppression list). Counts only;
// rows stay in the intel schema.

const count = async (table: "companies" | "people" | "contacts" | "field_values" | "possible_duplicates", f?: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = yintel().from(table).select("*", { count: "exact", head: true });
  if (f) q = f(q);
  const { count: n } = await q;
  return n ?? 0;
};

export async function dataOverview() {
  const staleBefore = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const [companies, people, contacts, verified, provenance, stale, duplicates, sources, suppression, dupRows] = await Promise.all([
    count("companies"),
    count("people"),
    count("contacts"),
    count("contacts", (q) => q.eq("status", "valid")),
    count("field_values"),
    count("companies", (q) => q.or(`refreshed_at.is.null,refreshed_at.lt.${staleBefore}`)),
    count("possible_duplicates", (q) => q.eq("status", "open")),
    yintel().from("field_values").select("source").order("fetched_at", { ascending: false }).limit(1000),
    yintel().from("suppression_list").select("*").order("created_at", { ascending: false }).limit(100),
    yintel().from("possible_duplicates").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(50),
  ]);
  const bySource: Record<string, number> = {};
  for (const r of sources.data ?? []) bySource[r.source] = (bySource[r.source] ?? 0) + 1;
  return { companies, people, contacts, verified, provenance, stale, duplicates, bySource, suppression: suppression.data ?? [], dupRows: dupRows.data ?? [] };
}

const kinds = ["email", "domain", "linkedin", "person"] as const;

export async function addSuppression(bos: BosUser, kind: string, raw: string, reason: string) {
  if (!(kinds as readonly string[]).includes(kind)) throw new ValidationError("نوع غير معروف.", { kind: "غير صالح" });
  let value = raw.trim().toLowerCase();
  if (kind === "linkedin") value = value.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  if (kind === "domain") value = value.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  if (!value || value.length > 300) throw new ValidationError("القيمة مطلوبة.", { value: "مطلوب" });
  const { error } = await yintel().from("suppression_list").upsert({ kind: kind as (typeof kinds)[number], value, reason: reason.trim() || null, created_by: bos.email }, { onConflict: "kind,value" });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.suppression.add", entityType: "yolias_suppression", entityId: null, newValue: { kind, value }, reason: reason || null });
}

export async function removeSuppression(bos: BosUser, id: string) {
  const { data } = await yintel().from("suppression_list").select("kind, value").eq("id", id).maybeSingle();
  await yintel().from("suppression_list").delete().eq("id", id);
  await audit({ actorId: bos.userId, action: "yolias.suppression.remove", entityType: "yolias_suppression", entityId: null, oldValue: data });
}

export async function resolveDuplicate(bos: BosUser, id: string, status: "distinct") {
  await yintel().from("possible_duplicates").update({ status }).eq("id", id);
  await audit({ actorId: bos.userId, action: "yolias.duplicate.resolve", entityType: "yolias_duplicate", entityId: null, newValue: { id, status } });
}
