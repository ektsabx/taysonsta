import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Yolias Partners (D-206): the affiliate portal is separate from the app. A
// partner only needs a signed-in account — no plan, no onboarding, no
// workspace setup — so it never goes through requireSession().

export interface PartnerUser { id: string; email: string; name: string | null; meta: Record<string, unknown> }

/** Cookie set by the partner sign-in / join forms: where /auth/confirm sends the user. */
export const NEXT_COOKIE = "yolias_next";

export async function partnerUser(): Promise<PartnerUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u?.email) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  return { id: u.id, email: u.email, name: typeof meta.full_name === "string" ? meta.full_name : null, meta };
}

export async function requirePartner(): Promise<PartnerUser> {
  const u = await partnerUser();
  if (!u) redirect("/partners/login");
  return u;
}
