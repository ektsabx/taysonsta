import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Yolias Partners (D-206): the affiliate portal is separate from the app. A
// partner only needs a signed-in account — no plan, no onboarding, no
// workspace setup — so it never goes through requireSession().

export interface PartnerUser { id: string; email: string; name: string | null; avatarUrl: string | null; createdAt: string; meta: Record<string, unknown> }

/** Cookie set by the partner sign-in / join forms: where /auth/confirm sends the user. */
export const NEXT_COOKIE = "yolias_next";

export const partnerUser = cache(async (): Promise<PartnerUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u?.email) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  // The app profile (if this account uses Yolias too) wins over sign-up metadata.
  const { data: profile } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", u.id).maybeSingle();
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  return {
    id: u.id, email: u.email, meta, createdAt: u.created_at,
    name: str(profile?.full_name) ?? str(meta.full_name),
    avatarUrl: str(profile?.avatar_url) ?? str(meta.avatar_url),
  };
});

export async function requirePartner(): Promise<PartnerUser> {
  const u = await partnerUser();
  if (!u) redirect("/partners/login");
  return u;
}
