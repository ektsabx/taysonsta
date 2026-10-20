// End-to-end test of data import (D-248) against the local Supabase:
//   npm run test:datasets
// Covers: rows normalised and staged like Yolias Admin does, matching with
// the shared database (domain, registry id, phone, same name and place),
// duplicates inside the file, a same-name-different-website pair kept apart
// for review, people linked to their company and deduplicated by LinkedIn,
// the report, the licence gate on search (only customer-facing datasets),
// the search adapter, and delete by source.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { normalizeRow, usable, type DatasetEntity, type DatasetMapping } from "@/lib/datasets/normalize.ts";
import { datasets as adapter } from "@/lib/intel/adapters/datasets.ts";
import type { Database, Json } from "@/types/database.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient<Database>(url, svc, { auth: { persistSession: false } }).schema("intel");
const stamp = Date.now().toString(36);
const created: string[] = [];
let seeded: string | null = null;

async function dataset(name: string, entity: DatasetEntity, mapping: DatasetMapping, rows: string[][], over: Partial<Database["intel"]["Tables"]["datasets"]["Insert"]> = {}) {
  const { data, error } = await db.from("datasets").insert({ name: `${name} ${stamp}`, entity, mapping: mapping as unknown as Json, status: "importing", file_rows: rows.length, customer_facing: true, default_country: "EG", created_by: "test", ...over }).select("*").single();
  if (error) throw error;
  created.push(data.id);
  const staged = rows.map((cells, i) => {
    const n = normalizeRow(cells, mapping, entity, { country: data.default_country });
    const ok = usable(n);
    return { dataset_id: data.id, row_no: i + 1, raw: cells as unknown as Json, data: n as unknown as Json, status: ok ? ("staged" as const) : ("invalid" as const), problems: ok ? n.problems : [...n.problems, "missing_name"] };
  });
  assert.equal((await db.from("dataset_rows").insert(staged)).error, null);
  for (let i = 0; i < 20; i++) {
    const merged: { data: Json | null; error: { message: string } | null } = await db.rpc("dataset_merge", { p_dataset: data.id, p_limit: 3 });
    assert.equal(merged.error, null);
    if ((merged.data as { remaining: number }).remaining === 0) break;
  }
  return data.id;
}
const rowsOf = async (id: string) => (await db.from("dataset_rows").select("row_no, status, company_id, person_id").eq("dataset_id", id).order("row_no")).data!;
const report = async (id: string) => { const r = await db.rpc("dataset_report", { p_dataset: id }); if (r.error) throw new Error(r.error.message); return r.data as unknown as Record<string, number> & { by_status: Record<string, number>; problems: Record<string, number>; filled: Record<string, number> }; };

try {
  // A company the shared database already knows (from a provider), with its name key.
  const { data: ex } = await db.from("companies").insert({ name: `Existing Co ${stamp}`, domain: `existing-${stamp}.example`, country: "EG", city: "Cairo", refreshed_at: new Date().toISOString() }).select("id").single();
  seeded = ex!.id;
  await db.from("company_identifiers").insert([{ kind: "domain", value: `existing-${stamp}.example`, company_id: seeded }, { kind: "name_key", value: `existing co ${stamp}|EG|cairo`, company_id: seeded }]);

  // ── 1. Companies ──
  const m = { company_name: 0, website: 1, email: 2, phone: 3, city: 4, registry_id: 5, industry: 6 };
  const a = await dataset("Bought list", "company", m, [
    [`Existing Co ${stamp}`, `https://www.existing-${stamp}.example`, `hello@existing-${stamp}.example`, "", "Cairo", "", "Software"],   // 1 merged by domain
    [`New Co ${stamp}`, `newco-${stamp}.example`, `info@newco-${stamp}.example`, "0101234567", "Giza", `CR-${stamp}`, "Logistics"], // 2 new
    [`New Co ${stamp} LLC`, `www.newco-${stamp}.example`, "", "", "Giza", "", ""],                                                     // 3 duplicate in file (domain)
    [`شركة النيل ${stamp} للتجارة`, "", "", "02 2345 6789", "Cairo", "", "تجارة"],                                                   // 4 new (no website)
    [`النيل ${stamp}`, "", "", "", "Cairo", "", ""],                                                                                   // 5 duplicate (same name + place)
    [`Other Name ${stamp}`, "", "", "+20 2 2345 6789", "Alex", "", ""],                                                               // 6 duplicate (same phone as 4)
    [`Renamed ${stamp}`, "", "", "", "Giza", `cr-${stamp}`, ""],                                                                       // 7 duplicate (registry id)
    [`Existing Co ${stamp}`, `different-${stamp}.example`, "", "", "Cairo", "", ""],                                                   // 8 new: same name, other website
    ["", "not a site", "nope", "", "", "", ""],                                                                                         // 9 invalid
  ]);
  const ra = await rowsOf(a);
  assert.deepEqual(ra.map((r) => r.status), ["merged", "new", "duplicate", "new", "duplicate", "duplicate", "duplicate", "new", "invalid"]);
  assert.equal(ra[0].company_id, seeded, "matched the existing company by domain");
  assert.equal(ra[2].company_id, ra[1].company_id);
  assert.equal(ra[4].company_id, ra[3].company_id, "Arabic name without legal words, same city");
  assert.equal(ra[5].company_id, ra[3].company_id, "same phone in another format");
  assert.equal(ra[6].company_id, ra[1].company_id, "same registry number, different case");
  assert.notEqual(ra[7].company_id, seeded, "a different website is never merged by name");
  const { data: dup } = await db.from("possible_duplicates").select("a, b").eq("a", seeded).eq("b", ra[7].company_id!);
  assert.equal(dup!.length, 1, "kept for review");
  // Existing values are kept; new ones recorded with their source.
  const { data: exNow } = await db.from("companies").select("*").eq("id", seeded).single();
  assert.equal(exNow!.industry, "Software", "an empty field is filled");
  const { data: fv } = await db.from("field_values").select("field, value, source").eq("entity_id", seeded).eq("source", `dataset:${a}`);
  assert.ok(fv!.some((f) => f.field === "email" && f.value === `hello@existing-${stamp}.example`));
  const rep = await report(a);
  assert.equal(rep.rows, 9);
  assert.deepEqual(rep.by_status, { merged: 1, new: 3, duplicate: 4, invalid: 1 });
  assert.equal(rep.companies_new, 3); assert.equal(rep.companies_matched, 1);
  assert.ok(rep.problems.website >= 1 && rep.problems.email >= 1);
  assert.equal(rep.possible_duplicates, 1);
  assert.equal((await db.from("datasets").select("status").eq("id", a).single()).data!.status, "ready", "all rows merged → ready");

  // ── 2. Search: customer-facing datasets only ──
  const icp = { summary: "", countries: ["EG"], cities: [], industries: [], keywords: [`${stamp}`], employees_min: null, employees_max: null, exclusions: [] } as unknown as Parameters<NonNullable<typeof adapter.handlers["company.search"]>>[0]["icp"];
  const found = await adapter.handlers["company.search"]!({ icp, limit: 50, offering: null }, { credential: null, fetch: async () => { throw new Error("no network"); } });
  const names = found.data.map((c) => c.name);
  assert.ok(names.includes(`New Co ${stamp}`), "new company found");
  assert.ok(found.data.find((c) => c.name === `New Co ${stamp}`)!.email === `info@newco-${stamp}.example`, "with the dataset's email");
  assert.ok(found.data.every((c) => c.email || c.phone || c.website || c.linkedinUrl), "only reachable companies");
  const internal = await dataset("Internal list", "company", m, [[`Secret Co ${stamp}`, `secret-${stamp}.example`, `a@secret-${stamp}.example`, "", "Cairo", "", ""]], { customer_facing: false });
  const again = await adapter.handlers["company.search"]!({ icp, limit: 50, offering: null }, { credential: null, fetch: async () => { throw new Error("no network"); } });
  assert.ok(!again.data.some((c) => c.name === `Secret Co ${stamp}`), "internal data never reaches customers");
  void internal;

  // ── 3. People ──
  const pm = { full_name: 0, title: 1, company_name: 2, website: 3, email: 4, linkedin_url: 5 };
  const p = await dataset("People list", "person", pm, [
    [`Sara Ali ${stamp}`, "Head of Sales", `New Co ${stamp}`, `newco-${stamp}.example`, `sara@newco-${stamp}.example`, `https://linkedin.com/in/sara-${stamp}`], // new person, existing company
    [`Sara A. ${stamp}`, "VP Sales", "New Co", "", "", `https://www.linkedin.com/in/sara-${stamp}/`],                                               // same LinkedIn → duplicate
    [`Omar Hassan ${stamp}`, "CEO", `Brand New ${stamp}`, `brandnew-${stamp}.example`, "", ""],                                                     // new person, new company
    [`Nobody ${stamp}`, "CTO", "", "", "", ""],                                                                                                       // invalid: no company
  ]);
  const rp = await rowsOf(p);
  assert.deepEqual(rp.map((r) => r.status), ["new", "duplicate", "new", "invalid"]);
  assert.equal(rp[0].company_id, ra[1].company_id, "linked to the company by website");
  assert.equal(rp[1].person_id, rp[0].person_id);
  const { data: contacts } = await db.from("contacts").select("kind, value, source").eq("person_id", rp[0].person_id!);
  assert.deepEqual(contacts!.map((c) => [c.kind, c.value, c.source]), [["work_email", `sara@newco-${stamp}.example`, `dataset:${p}`]]);
  const prep = await report(p);
  assert.equal(prep.people_new, 2); assert.equal(prep.companies_new, 1); assert.equal(prep.companies_matched, 1);

  // ── 4. Delete by source ──
  const { data: del } = await db.rpc("dataset_delete", { p_dataset: p, p_actor: "test" });
  assert.equal((del as { people: number }).people, 2);
  assert.equal((await db.from("people").select("id").eq("id", rp[0].person_id!)).data!.length, 0, "people it created are gone");
  assert.equal((await db.from("companies").select("id").eq("id", rp[2].company_id!)).data!.length, 0, "a company only it knew is gone");
  assert.equal((await db.from("companies").select("id").eq("id", ra[1].company_id!)).data!.length, 1, "a company another dataset brought stays");
  assert.equal((await db.from("datasets").select("status").eq("id", p).single()).data!.status, "deleted");
  await db.rpc("dataset_delete", { p_dataset: a, p_actor: "test" });
  assert.equal((await db.from("companies").select("id").eq("id", seeded).single()).data!.id, seeded, "a company that existed before stays");
  assert.equal((await db.from("field_values").select("id").eq("source", `dataset:${a}`)).data!.length, 0, "its values are gone");
  assert.equal((await db.from("companies").select("id").eq("id", ra[1].company_id!)).data!.length, 0);

  console.log("✓ datasets: matching (domain, registry, phone, name + place), in-file duplicates, same-name review, people by LinkedIn, report, licence gate on search, delete by source");
} finally {
  for (const id of created) await db.rpc("dataset_delete", { p_dataset: id, p_actor: "test" });
  if (created.length) await db.from("datasets").delete().in("id", created);
  if (seeded) await db.from("companies").delete().eq("id", seeded);
}
