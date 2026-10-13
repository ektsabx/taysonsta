import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Sign-up email policy (2026-10-12): no disposable inboxes. The list lives in
// public.blocked_email_domains (service role only, never sent to visitors)
// and the database refuses such sign-ups too (trigger on auth.users), so this
// check only gives the visitor a clear message before anything is sent.

/** Lower-case, trimmed, no trailing dot in the domain. */
export function normalizeEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  return at < 0 ? e : `${e.slice(0, at)}@${e.slice(at + 1).replace(/\.+$/, "")}`;
}

/** True when the domain (or a parent domain) is a known disposable-email service. */
export async function isDisposableEmail(email: string): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("email_domain_blocked", { p_email: normalizeEmail(email) });
  // If the check can't run, the database trigger still refuses the sign-up.
  if (error) {
    console.error("[auth] disposable check failed", error.message);
    return false;
  }
  return data === true;
}
