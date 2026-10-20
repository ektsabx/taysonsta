import "server-only";
import { intel } from "@/lib/intel/db";
import { readSite } from "@/lib/intel/socials";
import { enqueue } from "@/lib/jobs/queue";
import type { Json } from "@/types/database";

// Enrichment of an imported dataset (D-248): for each company it brought that
// has a website, our crawler reads the website (home page and contact page)
// and records the public email, phone and social profiles it publishes.
// Values are stored with their source ("yolias_crawler"); nothing is guessed.
// Runs as a background job, a few companies at a time, until done.

const BATCH = 8;
const SOURCE = "yolias_crawler";

export async function enrichDataset(datasetId: string): Promise<{ done: number; remaining: number }> {
  const db = intel();
  const { data: ds } = await db.from("datasets").select("id, status, enrich, enrich_state").eq("id", datasetId).maybeSingle();
  if (!ds || ds.status === "deleted" || !ds.enrich) return { done: 0, remaining: 0 };
  const { data: recs } = await db.from("dataset_records").select("entity_id").eq("dataset_id", datasetId).eq("entity_type", "company").is("enriched_at", null).limit(BATCH);
  const ids = (recs ?? []).map((r) => r.entity_id);
  const state = { checked: 0, with_site: 0, emails: 0, phones: 0, socials: 0, ...((ds.enrich_state as Record<string, number> | null) ?? {}) };
  if (ids.length) {
    const { data: companies } = await db.from("companies").select("id, name, website, domain, description, socials").in("id", ids);
    for (const co of companies ?? []) {
      state.checked++;
      const site = co.website ?? co.domain;
      if (site) {
        state.with_site++;
        const found = await readSite(site).catch(() => null);
        if (found) {
          const values: [string, string | null][] = [["email", found.email], ["phone", found.phone], ["linkedin_url", found.linkedinUrl], ["facebook_url", found.facebookUrl], ["instagram_url", found.instagramUrl]];
          const rows = values.filter(([, v]) => v).map(([field, v]) => ({ entity_type: "company" as const, entity_id: co.id, field, value: v as Json, source: SOURCE, license_scope: "yolias_shared" }));
          if (found.email) state.emails++;
          if (found.phone) state.phones++;
          const socials = { ...((co.socials as Record<string, string> | null) ?? {}), ...(found.facebookUrl ? { facebook: found.facebookUrl } : {}), ...(found.instagramUrl ? { instagram: found.instagramUrl } : {}), ...(found.linkedinUrl ? { linkedin: found.linkedinUrl } : {}) };
          // A row that only had a domain gets the name its website states.
          const named = found.name && (co.name === co.domain || co.name === site) ? { name: found.name } : {};
          const described = found.description && !co.description ? { description: found.description } : {};
          if (found.name && named.name) rows.push({ entity_type: "company", entity_id: co.id, field: "name", value: found.name as Json, source: SOURCE, license_scope: "yolias_shared" });
          if (found.facebookUrl || found.instagramUrl || found.linkedinUrl) state.socials++;
          if (found.facebookUrl || found.instagramUrl || found.linkedinUrl || named.name || described.description) {
            await db.from("companies").update({ socials, ...named, ...described, refreshed_at: new Date().toISOString() }).eq("id", co.id);
          }
          if (rows.length) await db.from("field_values").insert(rows);
        }
      }
    }
    await db.from("dataset_records").update({ enriched_at: new Date().toISOString() }).eq("dataset_id", datasetId).eq("entity_type", "company").in("entity_id", ids);
  }
  const { count } = await db.from("dataset_records").select("entity_id", { count: "exact", head: true }).eq("dataset_id", datasetId).eq("entity_type", "company").is("enriched_at", null);
  const remaining = count ?? 0;
  await db.from("datasets").update({ enrich_state: { ...state, remaining, updated_at: new Date().toISOString() } as Json }).eq("id", datasetId);
  if (remaining > 0) await enqueue("dataset.enrich", { datasetId });
  return { done: ids.length, remaining };
}
