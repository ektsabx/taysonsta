import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Unsubscribe from lifecycle and marketing email (D-243) by the token in the
// email (profiles.email_token), never by user id. Turns product updates off
// too. Account, security and payment emails are not affected.

export async function profileByToken(token: string): Promise<{ id: string; email: string; unsubscribed_at: string | null } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data } = await createAdminClient().from("profiles").select("id, email, unsubscribed_at").eq("email_token", token).maybeSingle();
  return data;
}

export async function unsubscribeByToken(token: string): Promise<{ email: string } | null> {
  const p = await profileByToken(token);
  if (!p) return null;
  const db = createAdminClient();
  if (!p.unsubscribed_at) await db.from("profiles").update({ unsubscribed_at: new Date().toISOString(), notify_product: false }).eq("id", p.id);
  // Lifecycle / marketing mail already queued for this user is canceled.
  await db.from("email_log").update({ status: "canceled", error: "unsubscribed" }).eq("user_id", p.id).eq("status", "queued").neq("email_class", "transactional");
  return { email: p.email };
}
