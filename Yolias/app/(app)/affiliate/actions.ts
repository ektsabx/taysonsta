"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { affiliateFor, applyAffiliate, requestPayout, savePayoutDetails } from "@/lib/affiliates";
import { affiliateNotify } from "@/lib/affiliates/notify";
import { createAdminClient } from "@/lib/supabase/admin";

// Affiliate actions for the signed-in member. Everything is checked here, on
// the server: the affiliate row always comes from the session's own user id,
// never from the form.

export type AffiliateActionResult = { ok: true } | { ok: false; error: string; field?: string };

export async function applyAction(input: { answers: Record<string, string>; acceptedTerms: string | null }): Promise<AffiliateActionResult> {
  const session = await requireSession();
  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const answers = Object.fromEntries(Object.entries(input.answers ?? {}).filter(([k, v]) => /^[a-z0-9_]{1,30}$/.test(k) && typeof v === "string").slice(0, 10));
  const r = await applyAffiliate({ id: session.userId, email: session.email }, { answers, acceptedTerms: typeof input.acceptedTerms === "string" ? input.acceptedTerms : null, ip });
  if (!r.ok) return { ok: false, error: r.error, field: r.field };
  const a = await affiliateFor(session.userId);
  if (a) await affiliateNotify(a.id, r.status === "approved" ? "approved" : "application_received", a.id);
  revalidatePath("/affiliate");
  return { ok: true };
}

export async function savePayoutAction(input: { method: string; details: string }): Promise<AffiliateActionResult> {
  const session = await requireSession();
  const a = await affiliateFor(session.userId);
  if (!a || a.status !== "approved") return { ok: false, error: "not_approved" };
  const r = await savePayoutDetails(a.id, String(input.method ?? ""), String(input.details ?? ""));
  if (r !== "ok") return { ok: false, error: r };
  revalidatePath("/affiliate");
  return { ok: true };
}

export async function requestPayoutAction(input: { method: string }): Promise<AffiliateActionResult> {
  const session = await requireSession();
  const a = await affiliateFor(session.userId);
  if (!a || a.status !== "approved") return { ok: false, error: "not_approved" };
  // A few requests a minute at most per affiliate (double clicks, scripts).
  const db = createAdminClient();
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db.from("affiliate_events").select("id", { count: "exact", head: true }).eq("affiliate_id", a.id).like("action", "payout.request%").gte("created_at", since);
  if ((count ?? 0) >= 3) return { ok: false, error: "failed" };
  const r = await requestPayout(a.id, String(input.method ?? a.payout_method ?? ""));
  if (!r.ok) {
    await db.rpc("affiliate_log", { p_affiliate: a.id, p_actor: `user:${session.userId}`, p_action: "payout.request_refused", p_type: "affiliate", p_id: a.id, p_before: null, p_after: { error: r.error } });
    return { ok: false, error: r.error };
  }
  const { data: p } = await db.from("affiliate_payouts").select("amount_cents").eq("id", r.payoutId).maybeSingle();
  await affiliateNotify(a.id, "payout_requested", r.payoutId, { amountCents: p ? Number(p.amount_cents) : null });
  revalidatePath("/affiliate");
  return { ok: true };
}
