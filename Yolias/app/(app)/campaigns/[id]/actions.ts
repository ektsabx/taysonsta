"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession, canEdit, viewOnly } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDictionary } from "@/lib/i18n/server";
import { logCampaign } from "@/lib/campaigns/activity";
import { pause as pauseSearch, resume as resumeSearch } from "@/lib/discovery/campaign-control";

// A campaign's audiences (owner, 2026-10-31, D-273): pause, resume or archive
// one, like an ad set. Adding an audience goes through the builder (Edit).

export type DetailResult<T = object> = ({ ok: true; message?: string } & T) | { ok: false; error: string };

export async function groupAction(groupId: string, action: "pause" | "resume" | "archive"): Promise<DetailResult> {
  const session = await requireSession();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  if (!z.string().uuid().safeParse(groupId).success || !["pause", "resume", "archive"].includes(action)) return { ok: false, error: t.ws.outreach.errors.notFound };
  const db = await createClient();
  const { data: g } = await db.from("audience_groups").select("*").eq("id", groupId).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!g) return { ok: false, error: t.ws.outreach.errors.notFound };
  const status = action === "resume" ? "active" : action === "pause" ? "paused" : "archived";
  await db.from("audience_groups").update({ status, updated_at: new Date().toISOString() }).eq("id", groupId);
  // Its search stops finding (and spending) while it is paused or archived, and goes on when resumed.
  if (g.search_campaign_id) await (action === "resume" ? resumeSearch(db, g.search_campaign_id) : pauseSearch(db, g.search_campaign_id));
  // Its people wait (or go on).
  await db.from("outreach_enrollments").update({ status: action === "resume" ? "active" : "paused" }).eq("audience_group_id", groupId).in("status", action === "resume" ? ["paused"] : ["active"]);
  await logCampaign(createAdminClient(), session.workspace.id, g.campaign_id, action === "resume" ? "resumed" : "paused", `Audience “${g.name}”: ${action === "resume" ? "resumed" : action === "pause" ? "paused" : "archived"}.`, { group: groupId, by: session.userId });
  revalidatePath(`/campaigns/${g.campaign_id}`);
  revalidatePath("/campaigns");
  return { ok: true, message: t.ag.page.saved };
}
