"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageTeam, requireSession } from "@/lib/session";
import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const preferencesSchema = z
  .object({
    theme: z.enum(["system", "light", "dark"]),
    text_size: z.enum(["compact", "normal", "large"]),
    language: z.enum(["en", "ar"]),
    timezone: z.enum(["Asia/Riyadh", "Asia/Dubai", "Africa/Cairo", "Europe/London"]),
    country: z.enum(["SA", "AE", "EG", "GB"]),
    notify_campaign_done: z.boolean(),
    full_name: z.string().trim().min(2).max(120),
  })
  .partial();

export async function updatePreferences(input: z.input<typeof preferencesSchema>): Promise<ActionResult> {
  const session = await requireSession();
  const t = (await getDictionary()).settings.errors;
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].path[0] === "full_name" ? t.nameRequired : t.saveFailed };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", session.userId);
  if (error) return { ok: false, error: t.saveFailed };
  // The language setting is also the interface language.
  if (parsed.data.language) {
    (await cookies()).set(LOCALE_COOKIE, parsed.data.language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// Called after the browser uploaded the image to avatars/<uid>/… (storage policy
// restricts uploads to the user's own folder).
export async function setAvatar(path: string): Promise<ActionResult> {
  const session = await requireSession();
  const t = (await getDictionary()).settings.errors;
  if (!path.startsWith(`${session.userId}/`)) return { ok: false, error: t.invalidAvatar };
  const supabase = await createClient();
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const { error } = await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", session.userId);
  if (error) return { ok: false, error: t.avatarFailed };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOut(scope: "local" | "global" = "local") {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope });
  redirect("/login");
}

export async function deleteAccount(): Promise<ActionResult> {
  const session = await requireSession();
  const t = (await getDictionary()).settings.errors;
  const admin = createAdminClient();
  const { count } = await admin.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", session.workspace.id);
  const soleMember = (count ?? 0) <= 1;
  if (session.role === "owner" && !soleMember) {
    return { ok: false, error: t.ownerWithTeam };
  }
  // Removing the workspace cascades to its strategies, campaigns, companies and prospects.
  if (soleMember) await admin.from("workspaces").delete().eq("id", session.workspace.id);
  const { error } = await admin.auth.admin.deleteUser(session.userId);
  if (error) return { ok: false, error: t.deleteFailed };
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/signup");
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["admin", "member"]),
});

export async function inviteMember(input: z.input<typeof inviteSchema>): Promise<ActionResult> {
  const session = await requireSession();
  const t = (await getDictionary()).settings.errors;
  if (!canManageTeam(session)) return { ok: false, error: t.onlyAdminsInvite };
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t.invalidEmail };
  const { email, role } = parsed.data;

  // Every plan includes unlimited users.
  const admin = createAdminClient();

  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return { ok: false, error: t.hasAccount };

  const { error } = await admin
    .from("workspace_invitations")
    .upsert({ workspace_id: session.workspace.id, email, role, invited_by: session.userId, accepted_at: null }, { onConflict: "workspace_id,email" });
  if (error) return { ok: false, error: t.inviteFailed };

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const { error: mailError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: site ? `${site}/auth/confirm` : undefined });
  if (mailError) {
    await admin.from("workspace_invitations").delete().eq("workspace_id", session.workspace.id).eq("email", email);
    return { ok: false, error: t.inviteEmailFailed };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!canManageTeam(session)) return { ok: false, error: (await getDictionary()).settings.errors.onlyAdminsManage };
  await createAdminClient().from("workspace_invitations").delete().eq("id", id).eq("workspace_id", session.workspace.id).is("accepted_at", null);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeMember(userId: string): Promise<ActionResult> {
  const session = await requireSession();
  const t = (await getDictionary()).settings.errors;
  if (!canManageTeam(session)) return { ok: false, error: t.onlyAdminsManage };
  if (userId === session.userId) return { ok: false, error: t.cantRemoveSelf };
  const admin = createAdminClient();
  const { data: member } = await admin.from("workspace_members").select("role").eq("workspace_id", session.workspace.id).eq("user_id", userId).maybeSingle();
  if (!member) return { ok: false, error: t.memberNotFound };
  if (member.role === "owner") return { ok: false, error: t.ownerCantBeRemoved };
  await admin.from("workspace_members").delete().eq("workspace_id", session.workspace.id).eq("user_id", userId);
  // A removed member gets their own empty workspace back so their account keeps working.
  const { data: ws } = await admin.from("workspaces").insert({ created_by: userId }).select("id").single();
  if (ws) {
    await admin.from("workspace_members").insert({ workspace_id: ws.id, user_id: userId, role: "owner" });
    await admin.from("profiles").update({ workspace_id: ws.id, onboarded_at: null }).eq("id", userId);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
