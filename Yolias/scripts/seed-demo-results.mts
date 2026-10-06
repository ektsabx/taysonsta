// LOCAL DEMO DATA ONLY. Fills the local demo workspace (demo@yolias.local)
// with one search of each type so the Prospects workspace, details and
// screenshots can be checked without a real data provider. The stand-in
// adapter exists only inside this process and every row is labelled with
// the source "demo_seed". Never run against production:
//   npm run seed:demo-results
import { createClient } from "@supabase/supabase-js";
import { runDiscovery } from "@/lib/discovery/pipeline.ts";
import type { IcpCriteria } from "@/lib/discovery/icp.ts";
import { installDemoAdapter } from "./demo-adapter.mts";
import type { Database } from "@/types/database.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Local database only.");
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: list } = await db.auth.admin.listUsers();
const user = list.users.find((u) => u.email === "demo@yolias.local");
if (!user) throw new Error("Create demo@yolias.local first.");
const ws = (await db.from("profiles").select("workspace_id").eq("id", user.id).single()).data!.workspace_id!;
await db.from("workspaces").update({ plan: "growth", subscription_status: "test" }).eq("id", ws);

const uninstall = await installDemoAdapter(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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
await uninstall();
