"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requirePartner } from "@/lib/partners";
import { affiliateFor, applyAffiliate, requestPayout, savePayoutDetails } from "@/lib/affiliates";
import { affiliateNotify } from "@/lib/affiliates/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { verifyImageFile } from "@/lib/uploads/image";
import { checkPayout, type PayoutValues } from "@/lib/affiliates/payout-fields";
import { isPartnerRole } from "@/lib/affiliates/directory";
import { isCountryCode } from "@/lib/country-codes";

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

/** Payout details: the chosen method's own fields, checked here (D-210). */
export async function savePayoutAction(input: { method: string; values: PayoutValues }): Promise<AffiliateActionResult> {
  const session = await requirePartner();
  const a = await affiliateFor(session.id);
  if (!a || a.status !== "approved") return { ok: false, error: "not_approved" };
  const method = String(input.method ?? "");
  const values = Object.fromEntries(Object.entries(input.values ?? {}).map(([k, v]) => [k, String(v ?? "").slice(0, 1000)])) as PayoutValues;
  const checked = checkPayout(method, values);
  if (!checked.ok) return { ok: false, error: "details", field: checked.field };
  const r = await savePayoutDetails(a.id, method, checked.details);
  if (r !== "ok") return { ok: false, error: r };
  revalidatePath("/partners");
  return { ok: true };
}

/** The partner's name on their account (the same account as the app, if they use it). */
export async function savePartnerProfileAction(input: { name: string }): Promise<AffiliateActionResult> {
  const user = await requirePartner();
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 80) return { ok: false, error: "name" };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
  if (error) return { ok: false, error: "failed" };
  await createAdminClient().from("profiles").update({ full_name: name }).eq("id", user.id);
  revalidatePath("/partners");
  return { ok: true };
}

/** Called after the browser uploaded the photo to avatars/<uid>/… (storage policy: own folder only). */
export async function setPartnerAvatarAction(path: string): Promise<AffiliateActionResult> {
  const user = await requirePartner();
  if (typeof path !== "string" || !path.startsWith(`${user.id}/`) || path.includes("..") || path.length > 300) return { ok: false, error: "avatar" };
  const admin = createAdminClient();
  const { data: blob } = await admin.storage.from("avatars").download(path);
  const checked = blob ? await verifyImageFile(blob) : { ok: false as const, error: "type" as const };
  if (!checked.ok) {
    await admin.storage.from("avatars").remove([path]);
    return { ok: false, error: checked.error === "size" ? "image_size" : "image_type" };
  }
  const url = admin.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  await (await createClient()).auth.updateUser({ data: { avatar_url: url } });
  await admin.from("profiles").update({ avatar_url: url }).eq("id", user.id);
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

/** Partner network (owner brief 2026-10-19): show me on /affiliates, with my role and country. */
export async function savePartnerListingAction(input: { listed: boolean; role: string | null; country: string | null }): Promise<AffiliateActionResult> {
  const user = await requirePartner();
  const a = await affiliateFor(user.id);
  if (!a || a.status !== "approved") return { ok: false, error: "not_approved" };
  const role = input.role ? String(input.role) : null;
  const country = input.country ? String(input.country).toUpperCase() : null;
  if (role !== null && !isPartnerRole(role)) return { ok: false, error: "failed" };
  if (country !== null && !isCountryCode(country)) return { ok: false, error: "failed" };
  const listed = input.listed === true;
  // Listed partners need a name, a role and a country on their card.
  if (listed && (!user.name || !role || !country)) return { ok: false, error: "listing_incomplete" };
  const { error } = await createAdminClient().from("affiliates").update({ listed, partner_role: role, country }).eq("id", a.id);
  if (error) return { ok: false, error: "failed" };
  revalidatePath("/partners");
  revalidatePath("/affiliates");
  return { ok: true };
}
