"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requirePartner } from "@/lib/partners";
import { affiliateFor, applyAffiliate, requestPayout, savePayoutDetails } from "@/lib/affiliates";
import { affiliateNotify } from "@/lib/affiliates/notify";
import { createAdminClient } from "@/lib/supabase/admin";

// Yolias Partners actions (D-206). Any signed-in account can be a partner (no
// plan needed). Everything is checked here, on the server: the affiliate row
// always comes from the signed-in user's own id, never from the form.

export type AffiliateActionResult = { ok: true } | { ok: false; error: string; field?: string };

/** Join: accept the terms and start right away — no application (D-206). */
export async function joinAction(acceptedTerms: string | null): Promise<AffiliateActionResult> {
  const user = await requirePartner();
  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const r = await applyAffiliate({ id: user.id, email: user.email }, { answers: {}, acceptedTerms: typeof acceptedTerms === "string" ? acceptedTerms : null, ip });
  if (!r.ok) return { ok: false, error: r.error, field: r.field };
  const a = await affiliateFor(user.id);
  if (a) await affiliateNotify(a.id, "approved", a.id);
  revalidatePath("/partners");
  return { ok: true };
}

export async function savePayoutAction(input: { method: string; details: string }): Promise<AffiliateActionResult> {
  const session = await requirePartner();
  const a = await affiliateFor(session.id);
  if (!a || a.status !== "approved") return { ok: false, error: "not_approved" };
  const r = await savePayoutDetails(a.id, String(input.method ?? ""), String(input.details ?? ""));
  if (r !== "ok") return { ok: false, error: r };
  revalidatePath("/partners");
  return { ok: true };
}

export async function requestPayoutAction(input: { method: string }): Promise<AffiliateActionResult> {
  const session = await requirePartner();
  const a = await affiliateFor(session.id);
  if (!a || a.status !== "approved") return { ok: false, error: "not_approved" };
  // A few requests a minute at most per affiliate (double clicks, scripts).
  const db = createAdminClient();
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db.from("affiliate_events").select("id", { count: "exact", head: true }).eq("affiliate_id", a.id).like("action", "payout.request%").gte("created_at", since);
  if ((count ?? 0) >= 3) return { ok: false, error: "failed" };
  const r = await requestPayout(a.id, String(input.method ?? a.payout_method ?? ""));
  if (!r.ok) {
    await db.rpc("affiliate_log", { p_affiliate: a.id, p_actor: `user:${session.id}`, p_action: "payout.request_refused", p_type: "affiliate", p_id: a.id, p_before: null, p_after: { error: r.error } });
    return { ok: false, error: r.error };
  }
  const { data: p } = await db.from("affiliate_payouts").select("amount_cents").eq("id", r.payoutId).maybeSingle();
  await affiliateNotify(a.id, "payout_requested", r.payoutId, { amountCents: p ? Number(p.amount_cents) : null });
  revalidatePath("/partners");
  return { ok: true };
}
