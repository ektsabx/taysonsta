"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/session";
import { canUseApp } from "@/lib/plans";
import { monthlyUsage } from "@/services/workspace";

// "Get ready for your first campaign" (owner, 2026-11-10): the steps before a
// campaign can reach customers, each checked against what the account has.
export type SetupStep = "knowledge" | "mailbox" | "booking" | "pixel" | "credit" | "campaign" | "launch";
export interface SetupState { done: Record<SetupStep, boolean>; teammates: boolean }

const KNOWLEDGE = ["about", "services", "products", "pricing", "differentiators", "case_studies", "faqs", "value_proposition"] as const;

export async function setupState(): Promise<SetupState | null> {
  const s = await requireUser();
  if (!s.profile.onboarded_at || s.role === "analyst") return null;
  const ws = s.workspace.id;
  const db = createAdminClient();
  const [{ data: k }, { count: boxes }, { data: page }, { data: px }, usage, { count: camps }, { count: launched }, { count: team }] = await Promise.all([
    db.from("workspace_knowledge").select(KNOWLEDGE.join(", ")).eq("workspace_id", ws).maybeSingle(),
    db.from("mailboxes").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "connected"),
    db.from("booking_pages").select("location, enabled").eq("user_id", s.userId).maybeSingle(),
    db.from("pixels").select("last_event_at").eq("workspace_id", ws).not("last_event_at", "is", null).limit(1),
    monthlyUsage(ws),
    db.from("outreach_campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", ws),
    db.from("outreach_campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", ws).not("approved_at", "is", null),
    db.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", ws),
  ]);
  const kn = (k ?? null) as unknown as Record<string, unknown> | null;
  const filled = KNOWLEDGE.filter((f) => typeof kn?.[f] === "string" && (kn[f] as string).trim().length > 20).length;
  return {
    done: {
      knowledge: filled >= 4,
      mailbox: (boxes ?? 0) > 0,
      booking: Boolean(page?.enabled && page.location?.trim()),
      pixel: Boolean(px?.length),
      credit: canUseApp(s.workspace) && Number(usage.available ?? 0) > 0,
      campaign: (camps ?? 0) > 0,
      launch: (launched ?? 0) > 0,
    },
    teammates: (team ?? 0) > 1,
  };
}
