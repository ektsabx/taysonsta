// LOCAL DEMO DATA ONLY. A stand-in data provider that exists only inside the
// seeding process: every row it produces is labelled with the source
// "demo_seed" and uses .example domains. Shared by the demo seed scripts.
import { adapters } from "@/lib/intel/adapters/index.ts";
import { syncRegistry } from "@/lib/intel/registry.ts";
import type { CompanyCandidate } from "@/lib/discovery/types.ts";

export const DEMO_SOURCE = "demo_seed";

const cities = ["Riyadh", "Jeddah", "Dubai", "Cairo"];
const names = ["Nakhla Pay", "Rimal Logistics", "Sahab Cloud", "Wadi Health", "Tamr Retail", "Najm Analytics", "Bayan Legal", "Dana Foods", "Qamar Energy", "Lulu Labs", "Asfar Travel", "Zeen Media"];
const people = [["Sara Al-Harbi", "Head of Sales"], ["Omar Khalil", "CEO"], ["Lina Mansour", "VP Marketing"], ["Yousef Nasser", "Founder"], ["Huda Saleh", "Sales Director"]];

// Each company search returns new companies (results are de-duplicated per workspace).
const suffixes = ["", " Group", " Labs", " Hub", " Co", " Partners"];
let round = 0;
const company = (i: number): CompanyCandidate => {
  const name = `${names[i % names.length]}${suffixes[Math.floor(i / names.length) % suffixes.length]}`;
  return {
  name, domain: `${name.toLowerCase().replace(/\s+/g, "")}.example`, industry: i % 2 ? "Fintech" : "SaaS",
  description: `${name} builds ${i % 2 ? "payments and lending" : "cloud software"} products for growing businesses across Saudi Arabia, the UAE and Egypt. The team focuses on fast onboarding, local support and integrations with the tools sales and finance teams already use. (Local demo data — not a real company.)`,
  logoUrl: `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(name)}`,
  linkedinUrl: `https://www.linkedin.com/company/demo-${name.toLowerCase().replace(/\s+/g, "-")}`,
  foundedYear: 2012 + (i % 11), city: cities[i % 4], country: i % 4 === 3 ? "EG" : i % 4 === 2 ? "AE" : "SA",
  employeeCount: 40 + i * 13, fundingStage: i % 3 ? "Series A" : null, fundingTotalUsd: null, hiringRoles: null, signals: [], sourceRef: `demo-${i}`,
  confidence: 0.7 + (i % 3) / 10,
  };
};

/** Registers the stand-in provider and enables it; call the returned function to disable it again. */
export async function installDemoAdapter(url: string, serviceKey: string): Promise<() => Promise<void>> {
  const { createClient } = await import("@supabase/supabase-js");
  const intel = createClient(url, serviceKey, { auth: { persistSession: false }, db: { schema: "intel" } });
  if (!adapters.some((a) => a.id === DEMO_SOURCE)) {
    adapters.push({
      id: DEMO_SOURCE, name: "Local demo data (not real)", needsCredential: false,
      handlers: {
        "company.search": async ({ limit }) => {
          const start = round++ * 8;
          return { data: Array.from({ length: Math.min(limit, 8) }, (_, i) => company(start + i)), units: 1 };
        },
        "company.lookalikes": async () => ({ data: [60, 61, 62, 63].map(company), units: 1 }),
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
            linkedinUrl: k === 2 ? null : `https://www.linkedin.com/in/demo-${fullName.split(" ")[0].toLowerCase()}-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, city: c.city, country: c.country, sourceRef: null,
            photoUrl: `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(fullName)}&backgroundColor=e8e8e4`,
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
  }
  await syncRegistry();
  await intel.from("providers").update({ enabled: true, storage_allowed: true, display_allowed: true, customer_facing_allowed: true }).eq("id", DEMO_SOURCE);
  // The stand-in stops being routable once this process ends; keep it disabled.
  return async () => { await intel.from("providers").update({ enabled: false }).eq("id", DEMO_SOURCE); };
}
