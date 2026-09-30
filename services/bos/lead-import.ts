import "server-only";
import { z } from "zod";
import { db } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { createLead, findDuplicateLead, updateLead, type LeadInput } from "@/services/bos/leads";

export interface ImportRow {
  name?: string;
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  country?: string;
  city?: string;
  industry?: string;
  source?: string;
  estimated_budget?: string;
  budget_currency?: string;
  notes?: string;
  assigned_email?: string;
}

const rowSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().optional().or(z.literal("")),
  estimated_budget: z.string().regex(/^\d+(\.\d{1,3})?$/).optional().or(z.literal("")),
  budget_currency: z.string().regex(/^[A-Z]{3}$/).optional().or(z.literal("")),
});

// CSV import (§7) with explicit duplicate handling — never silent.
export async function importLeads(bos: BosUser, rows: ImportRow[], duplicateMode: "skip" | "update") {
  const { data: sources } = await db().from("lead_sources").select("id, name");
  const sourceByName = new Map((sources ?? []).map((s) => [s.name.toLowerCase(), s.id]));
  const { data: staff } = await db().from("employees").select("user_id, email").not("user_id", "is", null);
  const userByEmail = new Map((staff ?? []).map((s) => [String(s.email ?? "").toLowerCase(), s.user_id!]));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [index, raw] of rows.entries()) {
    const line = index + 2;
    const parsed = rowSchema.safeParse({
      name: raw.name ?? raw.company_name ?? "",
      email: raw.email ?? "",
      estimated_budget: (raw.estimated_budget ?? "").replace(/[,\s]/g, ""),
      budget_currency: (raw.budget_currency ?? "").toUpperCase(),
    });
    if (!parsed.success) {
      errors.push(`سطر ${line}: بيانات غير صالحة (${parsed.error.issues.map((i) => i.path.join(".")).join(", ")})`);
      skipped++;
      continue;
    }
    const input: LeadInput = {
      name: parsed.data.name,
      company_name: raw.company_name?.trim() || null,
      contact_name: raw.contact_name?.trim() || null,
      email: parsed.data.email || null,
      phone: raw.phone?.trim() || null,
      website: raw.website?.trim() || null,
      country: raw.country?.trim() || null,
      city: raw.city?.trim() || null,
      industry: raw.industry?.trim() || null,
      source_id: raw.source ? sourceByName.get(raw.source.trim().toLowerCase()) ?? null : null,
      estimated_budget: parsed.data.estimated_budget || null,
      budget_currency: parsed.data.estimated_budget ? parsed.data.budget_currency || "USD" : null,
      product_interest_id: null,
      business_stage: null,
      timeline: null,
      decision_maker: null,
      current_solution: null,
      problem: null,
      notes: raw.notes?.trim() || null,
      assigned_to: raw.assigned_email ? userByEmail.get(raw.assigned_email.trim().toLowerCase()) ?? null : null,
      team_id: null,
      priority: "medium",
      budget_score: 0,
      fit_score: 0,
      intent_score: 0,
      engagement_score: 0,
    };

    try {
      const duplicate = await findDuplicateLead(input.email);
      if (duplicate) {
        if (duplicateMode === "update") {
          const { data: existing } = await db().from("leads").select("*").eq("id", duplicate.id).single();
          await updateLead(bos, duplicate.id, {
            ...input,
            assigned_to: input.assigned_to ?? existing!.assigned_to,
            budget_score: existing!.budget_score,
            fit_score: existing!.fit_score,
            intent_score: existing!.intent_score,
            engagement_score: existing!.engagement_score,
            priority: existing!.priority,
          });
          updated++;
        } else {
          skipped++;
          errors.push(`سطر ${line}: مكرر (${duplicate.lead_number}) — تم التخطي`);
        }
        continue;
      }
      await createLead(bos, input, { source: "import" });
      created++;
    } catch (error) {
      skipped++;
      errors.push(`سطر ${line}: ${error instanceof Error ? error.message : "خطأ"}`);
    }
  }

  await audit({ actorId: bos.userId, action: "lead.imported", entityType: "lead", entityId: null, newValue: { created, updated, skipped, rows: rows.length } });
  return { created, updated, skipped, errors: errors.slice(0, 100) };
}
