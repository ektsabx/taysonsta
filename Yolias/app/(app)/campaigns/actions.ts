"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import * as control from "@/lib/discovery/campaign-control";
import { getDictionary } from "@/lib/i18n/server";

// Campaign controls (final spec phase 6): goal, deadline, continuous
// schedule, pause / resume / stop / run now. The rules live in
// lib/discovery/campaign-control.ts (shared with Yolias AI); writes go
// through the member's own client (RLS: their workspace only).

export type CampaignResult = { ok: true } | { ok: false; error: string };

async function run(id: string, fn: (db: Awaited<ReturnType<typeof createClient>>) => Promise<control.ControlResult>): Promise<CampaignResult> {
  await requireSession();
  const r = await fn(await createClient());
  if (!r.ok) return { ok: false, error: (await getDictionary()).campaigns.errors[r.error] };
  revalidatePath(`/campaigns/${id}`);
  revalidatePath("/campaigns");
  return { ok: true };
}

export async function updateCampaignSettings(id: string, input: { goal: number; deadline: string | null; continuous: boolean; everyHours: number }): Promise<CampaignResult> {
  return run(id, (db) => control.updateSettings(db, id, input));
}

export async function pauseCampaign(id: string): Promise<CampaignResult> {
  return run(id, (db) => control.pause(db, id));
}

export async function resumeCampaign(id: string): Promise<CampaignResult> {
  return run(id, (db) => control.resume(db, id));
}

export async function runCampaignNow(id: string): Promise<CampaignResult> {
  return run(id, (db) => control.runNow(db, id));
}

export async function stopCampaign(id: string): Promise<CampaignResult> {
  return run(id, (db) => control.stop(db, id));
}
