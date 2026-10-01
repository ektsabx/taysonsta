import "server-only";
import type { CompanyCandidate, PersonCandidate } from "@/lib/discovery/types";
import { classifySeniority } from "@/lib/discovery/match";
import { asJson, getSetting, intel } from "@/lib/intel/db";
import { isStale, linkedinKey, normalizeEmail, normalizeName, personMatch, presentFields, registrableDomain } from "@/lib/intel/identity";
import type { SourceLicense } from "@/lib/intel/service";
import type { IntelCompanyRow } from "@/types/database";

// Shared intelligence writer/reader (docs/04): identity resolution, field
// provenance, freshness and the search cache. Service role only. Customer
// data never lands here — only what providers returned, under their license.

export interface Source {
  provider: string;
  license: SourceLicense;
  callId: number | null;
}

type Ttl = Record<string, number>;
const ttlDefaults: Ttl = { company_firmographics: 90, person_employment: 45, email_verification: 30, phone: 90, search_cache: 7 };
async function ttl(): Promise<Ttl> {
  return { ...ttlDefaults, ...(await getSetting<Ttl>("ttl_days", {})) };
}
const plusDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

async function provenance(entity: "company" | "person" | "contact", id: string, fields: [string, unknown][], src: Source, ttlDays: number) {
  if (!fields.length) return;
  await intel().from("field_values").insert(
    fields.map(([field, value]) => ({
      entity_type: entity, entity_id: id, field, value: asJson(value), source: src.provider, provider_call_id: src.callId,
      license_scope: src.license.scope, expires_at: plusDays(ttlDays),
    })),
  );
}

// ───────────────────────── Companies ─────────────────────────

/** Finds the company by domain (eTLD+1) → provider id, or creates it. Fills only empty fields; records provenance. */
export async function upsertCompany(c: CompanyCandidate, src: Source): Promise<string> {
  const db = intel();
  const domain = registrableDomain(c.domain);
  const providerKey = c.sourceRef ? `${src.provider}:${c.sourceRef}` : null;
  let id: string | null = null;
  for (const [kind, value] of [["domain", domain], ["provider", providerKey]] as const) {
    if (!value) continue;
    const { data } = await db.from("company_identifiers").select("company_id").eq("kind", kind).eq("value", value).maybeSingle();
    if (data) {
      id = data.company_id;
      break;
    }
  }
  const fields = {
    name: c.name, domain, industry: c.industry, description: c.description, employee_count: c.employeeCount, city: c.city, country: c.country,
  };
  if (!id) {
    const { data, error } = await db.from("companies").insert({ ...fields, refreshed_at: new Date().toISOString(), redistributable: src.license.redistributable }).select("id").single();
    if (error || !data) {
      // Raced with another worker on the unique domain: use theirs.
      const { data: again } = domain ? await db.from("companies").select("id").eq("domain", domain).maybeSingle() : { data: null };
      if (!again) throw new Error(`company upsert failed: ${error?.message}`);
      id = again.id;
    } else {
      id = data.id;
    }
  } else {
    const { data: cur } = await db.from("companies").select("*").eq("id", id).single();
    const patch: Partial<IntelCompanyRow> = { refreshed_at: new Date().toISOString() };
    for (const [k, v] of Object.entries(fields)) if (v != null && cur && (cur as Record<string, unknown>)[k] == null) (patch as Record<string, unknown>)[k] = v;
    if (src.license.redistributable && cur && !cur.redistributable) patch.redistributable = true;
    await db.from("companies").update(patch).eq("id", id);
  }
  const ids = [domain && { kind: "domain", value: domain }, providerKey && { kind: "provider", value: providerKey }].filter(Boolean) as { kind: string; value: string }[];
  if (ids.length) await db.from("company_identifiers").upsert(ids.map((i) => ({ ...i, company_id: id! })), { onConflict: "kind,value", ignoreDuplicates: true });
  await provenance("company", id, presentFields(fields, Object.keys(fields)), src, (await ttl()).company_firmographics);
  return id;
}

// ───────────────────────── People ─────────────────────────

/**
 * Resolves a person: LinkedIn → verified email → company + normalised name.
 * Two different LinkedIn profiles with the same name at the same company are
 * kept apart and recorded as a possible duplicate (rule 22).
 */
export async function upsertPerson(p: PersonCandidate, companyId: string, src: Source): Promise<string> {
  const db = intel();
  const linkedin = linkedinKey(p.linkedinUrl);
  const email = normalizeEmail(p.email);
  const name = normalizeName(p.fullName);
  let id: string | null = null;
  for (const [kind, value] of [["linkedin", linkedin], ["email", email]] as const) {
    if (!value) continue;
    const { data } = await db.from("person_identifiers").select("person_id").eq("kind", kind).eq("value", value).maybeSingle();
    if (data) {
      id = data.person_id;
      break;
    }
  }
  let duplicateOf: string | null = null;
  if (!id && name) {
    const { data: sameName } = await db.from("people").select("id, linkedin_url").eq("current_company_id", companyId).eq("normalized_name", name).limit(5);
    for (const cand of sameName ?? []) {
      const m = personMatch({ linkedin, name, companyId, email }, { linkedin: linkedinKey(cand.linkedin_url), name, companyId, email: null });
      if (m === "same") {
        id = cand.id;
        break;
      }
      if (m === "possible_duplicate") duplicateOf = cand.id;
    }
  }
  const fields = { full_name: p.fullName, linkedin_url: linkedin ? `https://www.${linkedin}` : null, title: p.title, seniority: classifySeniority(p.title), city: p.city, country: p.country };
  if (!id) {
    const { data, error } = await db.from("people").insert({ ...fields, normalized_name: name, current_company_id: companyId, refreshed_at: new Date().toISOString(), redistributable: src.license.redistributable }).select("id").single();
    if (error || !data) throw new Error(`person upsert failed: ${error?.message}`);
    id = data.id;
    if (duplicateOf) await db.from("possible_duplicates").upsert({ entity_type: "person", a: duplicateOf, b: id, reason: "same name and company, different LinkedIn" }, { onConflict: "entity_type,a,b", ignoreDuplicates: true });
  } else {
    await db.from("people").update({ title: p.title ?? undefined, current_company_id: companyId, refreshed_at: new Date().toISOString() }).eq("id", id);
  }
  const ids = [linkedin && { kind: "linkedin", value: linkedin }].filter(Boolean) as { kind: string; value: string }[];
  if (ids.length) await db.from("person_identifiers").upsert(ids.map((i) => ({ ...i, person_id: id! })), { onConflict: "kind,value", ignoreDuplicates: true });
  await db.from("employments").upsert(
    { person_id: id, company_id: companyId, title: p.title, seniority: fields.seniority, is_current: true, source: src.provider, observed_at: new Date().toISOString() },
    { onConflict: "person_id,company_id,title", ignoreDuplicates: false },
  );
  const t = await ttl();
  await provenance("person", id, presentFields(fields, Object.keys(fields)), src, t.person_employment);
  if (email) await saveContact(id, "work_email", email, src, "unknown");
  if (p.phone) await saveContact(id, "phone", p.phone, src, "unknown");
  return id;
}

export async function saveContact(personId: string, kind: "work_email" | "phone" | "mobile", value: string, src: Source, status: "unknown" | "valid" | "invalid" | "catch_all" | "risky", verifiedBy?: string) {
  const db = intel();
  const row = {
    person_id: personId, kind, value, source: src.provider, observed_at: new Date().toISOString(), status,
    ...(status !== "unknown" ? { verified_at: new Date().toISOString(), verified_by: verifiedBy ?? src.provider } : {}),
  };
  await db.from("contacts").upsert(row, { onConflict: "person_id,kind,value" });
  // A verified email identifies the person.
  if (kind === "work_email" && status === "valid") {
    await db.from("person_identifiers").upsert({ kind: "email", value, person_id: personId }, { onConflict: "kind,value", ignoreDuplicates: true });
  }
}

// ───────────────────────── Suppression ─────────────────────────

/** Never deliver someone on the suppression list (rule 34): by email, email domain, LinkedIn or person id. */
export async function isSuppressed(p: { email?: string | null; linkedinUrl?: string | null; personId?: string | null }): Promise<boolean> {
  const checks: { kind: string; value: string }[] = [];
  const email = normalizeEmail(p.email);
  if (email) {
    const host = email.split("@")[1];
    checks.push({ kind: "email", value: email }, { kind: "domain", value: host });
    const reg = registrableDomain(host);
    if (reg && reg !== host) checks.push({ kind: "domain", value: reg });
  }
  const li = linkedinKey(p.linkedinUrl);
  if (li) checks.push({ kind: "linkedin", value: li });
  if (p.personId) checks.push({ kind: "person", value: p.personId });
  for (const c of checks.filter((c) => c.value)) {
    const { count } = await intel().from("suppression_list").select("id", { count: "exact", head: true }).eq("kind", c.kind as "email").eq("value", c.value);
    if (count) return true;
  }
  return false;
}

// ───────────────────────── Search cache ─────────────────────────

/**
 * Companies found earlier for the same ICP fingerprint, when still fresh and
 * licensed for this workspace (cross-workspace reuse needs redistribution
 * rights). Ladder step 1: shared DB before paying a provider (rule 15).
 */
export async function cachedCompanies(fingerprint: string, workspaceId: string): Promise<(CompanyCandidate & { intelId: string })[] | null> {
  const db = intel();
  const { data: hit } = await db.from("search_cache").select("*").eq("fingerprint", fingerprint).maybeSingle();
  if (!hit || new Date(hit.expires_at) < new Date() || !hit.company_ids.length) return null;
  if (!hit.redistributable && hit.workspace_id !== workspaceId) return null;
  const { data: rows } = await db.from("companies").select("*").in("id", hit.company_ids);
  const fresh = (rows ?? []).filter((r) => !isStale(r.refreshed_at, ttlDefaults.company_firmographics));
  if (fresh.length < hit.company_ids.length) return null; // something went stale: ask the provider again
  return fresh.map((r) => ({
    intelId: r.id, name: r.name, domain: r.domain, industry: r.industry, description: r.description, city: r.city, country: r.country,
    employeeCount: r.employee_count, fundingStage: null, fundingTotalUsd: null, hiringRoles: null, signals: [], sourceRef: null,
  }));
}

export async function cacheCompanies(fingerprint: string, workspaceId: string, companyIds: string[], redistributable: boolean, provider: string) {
  const ids = [...new Set(companyIds)];
  if (!ids.length) return;
  await intel().from("search_cache").upsert({
    fingerprint, company_ids: ids, redistributable, workspace_id: workspaceId, meta: asJson({ provider }),
    created_at: new Date().toISOString(), expires_at: plusDays((await ttl()).search_cache),
  });
}
