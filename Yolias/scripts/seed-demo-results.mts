// LOCAL DEMO DATA ONLY. Fills the local demo workspace (demo@yolias.local)
// with one search of each type so the Prospects workspace, details and
// screenshots can be checked without a real data provider. The stand-in
// adapter exists only inside this process and every row is labelled with
// the source "demo_seed". Never run against production:
//   npm run seed:demo-results
import { createClient } from "@supabase/supabase-js";
import { adapters } from "@/lib/intel/adapters/index.ts";
import { syncRegistry } from "@/lib/intel/registry.ts";
import { runDiscovery } from "@/lib/discovery/pipeline.ts";
import type { IcpCriteria } from "@/lib/discovery/icp.ts";
import type { CompanyCandidate } from "@/lib/discovery/types.ts";
import type { Database } from "@/types/database.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Local database only.");
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const intel = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false }, db: { schema: "intel" } });
const ID = "demo_seed";

const cities = ["Riyadh", "Jeddah", "Dubai", "Cairo"];
const names = ["Nakhla Pay", "Rimal Logistics", "Sahab Cloud", "Wadi Health", "Tamr Retail", "Najm Analytics", "Bayan Legal", "Dana Foods", "Qamar Energy", "Lulu Labs", "Asfar Travel", "Zeen Media"];
const people = [["Sara Al-Harbi", "Head of Sales"], ["Omar Khalil", "CEO"], ["Lina Mansour", "VP Marketing"], ["Yousef Nasser", "Founder"], ["Huda Saleh", "Sales Director"]];
const company = (i: number): CompanyCandidate => ({
  name: names[i % names.length], domain: `${names[i % names.length].toLowerCase().replace(/\s+/g, "")}.example`, industry: i % 2 ? "Fintech" : "SaaS",
  description: "Demo company (local demo data).", city: cities[i % 4], country: i % 4 === 3 ? "EG" : i % 4 === 2 ? "AE" : "SA",
  employeeCount: 40 + i * 13, fundingStage: i % 3 ? "Series A" : null, fundingTotalUsd: null, hiringRoles: null, signals: [], sourceRef: `demo-${i}`,
  confidence: 0.7 + (i % 3) / 10,
});
adapters.push({
  id: ID, name: "Local demo data (not real)", needsCredential: false,
  handlers: {
    "company.search": async ({ limit }) => ({ data: Array.from({ length: Math.min(limit, 8) }, (_, i) => company(i)), units: 1 }),
    "company.lookalikes": async () => ({ data: [8, 9, 10, 11].map(company), units: 1 }),
    "place.search": async () => ({
      data: ["Smile Dental Clinic", "Orchid Spa", "Bab Al Yemen Restaurant", "Fit Hub Gym", "Noor Pharmacy"].map((name, i) => ({
        name, domain: null, industry: null, description: null, city: "Riyadh", country: "SA", employeeCount: null, fundingStage: null, fundingTotalUsd: null,
        hiringRoles: null, signals: [], sourceRef: `demo-place-${i}`, kind: "local_business" as const, category: ["Dental clinic", "Spa", "Restaurant", "Gym", "Pharmacy"][i],
        address: i === 3 ? null : `${100 + i} King Fahd Rd, Riyadh`, phone: i === 1 ? null : `+966 11 400 0${i}${i}${i}`, website: i % 2 ? null : `${name.toLowerCase().replace(/\s+/g, "")}.example`,
        rating: 3.9 + i / 5, reviewsCount: 40 + i * 31, placeRef: `demo-place-${i}`, mapsUrl: `https://maps.example/demo-${i}`,
      })),
      units: 1,
    }),
    "person.search": async ({ company: c }) => ({
      data: people.slice(0, 2 + (c.name.length % 3)).map(([fullName, title], k) => ({
        fullName, title, email: k === 2 ? null : `${fullName.split(" ")[0].toLowerCase()}@${c.domain ?? "demo.example"}`, phone: k === 0 ? "+966 50 123 45" + (c.name.length % 10) + k : null,
        linkedinUrl: k === 1 ? `https://www.linkedin.com/in/demo-${fullName.split(" ")[0].toLowerCase()}-${c.name.length}` : null, city: c.city, country: c.country, sourceRef: null,
      })),
      units: 1,
    }),
    "job.search": async ({ company: c }) => ({
      data: [["Account Executive", "Sales"], ["Growth Marketer", "Marketing"]].map(([title, department], k) => ({
        title, department, city: c?.city ?? null, country: c?.country ?? null, url: `https://jobs.example/${c?.domain}/${k}`, postedAt: new Date(Date.now() - k * 86_400_000 * 3).toISOString(),
        company: { name: c?.name ?? "", domain: c?.domain ?? null }, sourceRef: null,
      })),
      units: 1,
    }),
  },
});

const { data: list } = await db.auth.admin.listUsers();
const user = list.users.find((u) => u.email === "demo@yolias.local");
if (!user) throw new Error("Create demo@yolias.local first.");
const ws = (await db.from("profiles").select("workspace_id").eq("id", user.id).single()).data!.workspace_id!;
await db.from("workspaces").update({ plan: "growth", subscription_status: "test" }).eq("id", ws);

await syncRegistry();
await intel.from("providers").update({ enabled: true, storage_allowed: true, display_allowed: true, customer_facing_allowed: true }).eq("id", ID);

const base: Omit<IcpCriteria, "search_type" | "campaign_name" | "summary"> = {
  lookalike_seeds: [], target_count: 10, target_unit: "prospects", countries: ["SA", "AE", "EG"], cities: [], industries: ["Fintech", "SaaS"], keywords: [],
  employees_min: 20, employees_max: 500, job_titles: ["Head of Sales", "CEO", "Founder"], seniorities: ["founder", "c_level"], hiring: null, hiring_roles: [],
  funding_stages: [], technologies: [], exclusions: [], assumptions: ["Demo data"],
};
const searches: [string, IcpCriteria][] = [
  ["Fintech and SaaS founders in the Gulf and Egypt", { ...base, search_type: "people", hiring: true, campaign_name: "GCC & Egypt SaaS — Founders", summary: "Founders and sales leaders of SaaS and fintech companies" }],
  ["SaaS companies in Saudi Arabia", { ...base, search_type: "companies", campaign_name: "Saudi SaaS — Companies", summary: "SaaS companies in Saudi Arabia" }],
  ["Companies like Tabby and Tamara", { ...base, search_type: "company_lookalikes", lookalike_seeds: ["tabby.ai", "tamara.co"], campaign_name: "Lookalikes of Tabby & Tamara", summary: "Companies similar to Tabby and Tamara" }],
  ["Clinics, spas and gyms in Riyadh", { ...base, search_type: "local_businesses", cities: ["Riyadh"], industries: ["Clinic", "Spa", "Gym", "Restaurant", "Pharmacy"], campaign_name: "Riyadh local businesses", summary: "Local businesses in Riyadh" }],
];
for (const [prompt, icp] of searches) {
  const { data: s } = await db.from("strategies").insert({ workspace_id: ws, created_by: user.id, title: icp.campaign_name, prompt, icp: icp as never, status: "ready" }).select("id").single();
  const { data: c } = await db.from("campaigns").insert({ workspace_id: ws, strategy_id: s!.id, created_by: user.id, name: icp.campaign_name, criteria: icp as never, search_type: icp.search_type, quota: icp.target_count, status: "queued" }).select("id").single();
  await runDiscovery(c!.id);
  const now = new Date().toISOString();
  await db.from("prospects").update({ saved_at: now }).eq("campaign_id", c!.id);
  await db.from("companies").update({ saved_at: now }).eq("campaign_id", c!.id).not("delivered_at", "is", null);
  console.log(`✓ ${icp.search_type}: ${icp.campaign_name}`);
}
// The stand-in stops being routable once this process ends; keep it disabled.
await intel.from("providers").update({ enabled: false }).eq("id", ID);
