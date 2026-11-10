"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/session";
import { isToken } from "@/lib/team/join";

export type JoinError = "signin" | "invalid" | "email" | "team" | "data" | "otherTeam" | "failed";

/**
 * Accepting a team invitation (audit, 2026-11-10). A signed-in person whose
 * email the invitation is for joins the team with its role. Their own empty
 * workspace (made at sign-up, or given back when a team removed them) is
 * deleted; a workspace with a team, campaigns or payments is never left behind.
 */
export async function acceptInvitation(token: string): Promise<{ ok: true } | { ok: false; error: JoinError }> {
  if (!isToken(token)) return { ok: false, error: "invalid" };
  const session = await getSession();
  if (!session) return { ok: false, error: "signin" };
  const admin = createAdminClient();
  const { data: inv } = await admin.from("workspace_invitations").select("id, workspace_id, email, role, accepted_at, invited_by").eq("token", token).maybeSingle();
  if (!inv || inv.accepted_at) return { ok: false, error: "invalid" };
  if (inv.email.toLowerCase() !== session.email.toLowerCase()) return { ok: false, error: "email" };

  const own = session.workspace.id;
  let dropOwn = false;
  if (own !== inv.workspace_id) {
    if (session.role !== "owner") return { ok: false, error: "otherTeam" };
    const [{ count: members }, { count: camps }, { count: paid }] = await Promise.all([
      admin.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", own),
      admin.from("outreach_campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", own),
      admin.from("payments").select("id", { count: "exact", head: true }).eq("workspace_id", own).eq("status", "succeeded"),
    ]);
    if ((members ?? 0) > 1) return { ok: false, error: "team" };
    if ((camps ?? 0) > 0 || (paid ?? 0) > 0) return { ok: false, error: "data" };
    dropOwn = true;
  }

  const { error } = await admin.from("workspace_members").upsert({ workspace_id: inv.workspace_id, user_id: session.userId, role: inv.role }, { onConflict: "workspace_id,user_id" });
  if (error) return { ok: false, error: "failed" };
  await admin.from("profiles").update({ workspace_id: inv.workspace_id }).eq("id", session.userId);
  await admin.from("workspace_invitations").update({ accepted_at: new Date().toISOString() }).eq("id", inv.id);
  if (dropOwn) await admin.from("workspaces").delete().eq("id", own);
  if (inv.invited_by) {
    const { data: who } = await admin.from("profiles").select("language").eq("id", inv.invited_by).maybeSingle();
    const name = session.profile.full_name || session.email;
    await admin.from("notifications").insert({ user_id: inv.invited_by, workspace_id: inv.workspace_id, kind: "team", title: who?.language === "ar" ? `انضم ${name} إلى فريقك` : `${name} joined your team`, body: null, link: "/dashboard?settings=team", dedupe_key: `joined:${inv.id}` });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
