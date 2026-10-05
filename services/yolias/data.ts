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

/* Shared intelligence browser (docs/09 §B "Prospects · Companies · People",
   "Data sources · Provenance · Freshness"). Read-only. */

const PAGE_SIZE = 50;

async function ttlDays(key: string, fallback: number): Promise<number> {
  const { data } = await yintel().from("settings").select("value").eq("key", "ttl_days").maybeSingle();
  const v = (data?.value as Record<string, number> | null)?.[key];
  return typeof v === "number" && v > 0 ? v : fallback;
}

export async function listSharedCompanies(opts: { q?: string; stale?: boolean; page: number }) {
  const ttl = await ttlDays("company_firmographics", 90);
  const staleBefore = new Date(Date.now() - ttl * 86_400_000).toISOString();
  let q = yintel().from("companies").select("id, name, domain, industry, employee_count, city, country, refreshed_at, redistributable", { count: "exact" });
  if (opts.q) {
    const term = opts.q.replace(/[%_,()]/g, " ").trim();
    if (term) q = q.or(`name.ilike.%${term}%,domain.ilike.%${term}%`);
  }
  if (opts.stale) q = q.or(`refreshed_at.is.null,refreshed_at.lt.${staleBefore}`);
  const { data, count, error } = await q.order("refreshed_at", { ascending: false, nullsFirst: false }).range((opts.page - 1) * PAGE_SIZE, opts.page * PAGE_SIZE - 1);
  if (error) throw error;
  const rows = data ?? [];
  const { data: people } = rows.length ? await yintel().from("people").select("current_company_id").in("current_company_id", rows.map((r) => r.id)) : { data: [] as { current_company_id: string | null }[] };
  const peopleCount = new Map<string, number>();
  for (const p of people ?? []) if (p.current_company_id) peopleCount.set(p.current_company_id, (peopleCount.get(p.current_company_id) ?? 0) + 1);
  return {
    ttl,
    total: count ?? 0,
    pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
    rows: rows.map((r) => ({ ...r, stale: !r.refreshed_at || r.refreshed_at < staleBefore, people: peopleCount.get(r.id) ?? 0 })),
  };
}

export async function getSharedCompany(id: string) {
  const { data: company } = await yintel().from("companies").select("*").eq("id", id).maybeSingle();
  if (!company) return null;
  const [{ data: ids }, { data: fields }, { data: people }] = await Promise.all([
    yintel().from("company_identifiers").select("kind, value").eq("company_id", id),
    yintel().from("field_values").select("field, value, source, license_scope, confidence, fetched_at, expires_at").eq("entity_type", "company").eq("entity_id", id).order("fetched_at", { ascending: false }).limit(200),
    yintel().from("people").select("id, full_name, title, seniority, linkedin_url, country, refreshed_at, redistributable").eq("current_company_id", id).order("full_name").limit(200),
  ]);
  const personIds = (people ?? []).map((p) => p.id);
  const [{ data: contacts }, { data: personFields }, { data: dups }] = await Promise.all([
    personIds.length ? yintel().from("contacts").select("person_id, kind, value, status, verified_at, verified_by, source, observed_at").in("person_id", personIds) : Promise.resolve({ data: [] }),
    personIds.length ? yintel().from("field_values").select("entity_id, field, source, fetched_at").eq("entity_type", "person").in("entity_id", personIds).order("fetched_at", { ascending: false }).limit(500) : Promise.resolve({ data: [] }),
    personIds.length ? yintel().from("possible_duplicates").select("a, b, status").eq("entity_type", "person").or(`a.in.(${personIds.join(",")}),b.in.(${personIds.join(",")})`) : Promise.resolve({ data: [] }),
  ]);
  return {
    company,
    identifiers: ids ?? [],
    fields: fields ?? [],
    people: (people ?? []).map((p) => ({
      ...p,
      contacts: (contacts ?? []).filter((c) => c.person_id === p.id),
      sources: [...new Set((personFields ?? []).filter((f) => f.entity_id === p.id).map((f) => f.source))],
      possibleDuplicate: (dups ?? []).some((d) => (d.a === p.id || d.b === p.id) && d.status === "open"),
    })),
  };
}
