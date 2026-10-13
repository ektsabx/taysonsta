import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, userRecipient } from "@/lib/email/notify";
import type { AffiliateEmailEvent } from "@/lib/email/messages";
import { currentProgram } from "./index";

// Affiliate notices (email + in-app bell). `dedupeId` is the record the
// notice is about (affiliate, commission, payout, terms version), so a
// re-processed event never sends the same notice twice.

export async function affiliateNotify(
  affiliateId: string,
  event: AffiliateEmailEvent,
  dedupeId: string,
  extra: { amountCents?: number | null; reason?: string | null; reference?: string | null } = {},
): Promise<number> {
  const db = createAdminClient();
  const program = await currentProgram(db);
  if (program && !program.settings.notifyAffiliates) return 0;
  const { data: a } = await db.from("affiliates").select("user_id").eq("id", affiliateId).maybeSingle();
  if (!a?.user_id) return 0;
  return notify("affiliate_update", await userRecipient(a.user_id), {
    event, amountCents: extra.amountCents ?? null, reason: extra.reason ?? null, reference: extra.reference ?? null,
  }, { dedupe: `${event}:${dedupeId}` });
}

/** Commissions whose waiting period ended become available (hourly, from the billing sweep). */
export async function matureCommissions(): Promise<number> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("affiliate_mature", {});
  if (error) throw new Error(`affiliate_mature: ${error.message}`);
  for (const row of data ?? []) {
    const { data: c } = await db.from("affiliate_commissions").select("amount_cents").eq("id", row.out_commission).maybeSingle();
    await affiliateNotify(row.out_affiliate, "commission_available", row.out_commission, { amountCents: c ? Number(c.amount_cents) : null });
  }
  return data?.length ?? 0;
}
