"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/server";
import { changeStage } from "@/lib/crm";
import { sendReply } from "@/app/(app)/inbox/actions";

// Sends a quote in the customer's conversation (owner, 2026-10-29): the lines
// and total as the email's text, from the member's mailbox, like any reply.
// The quote is kept on the customer's timeline (as a note with its lines), the deal value becomes the
// total, and an open deal before the proposal stage moves to Proposal.

const input = z.object({
  leadId: z.string().uuid(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  lines: z.array(z.object({ text: z.string().trim().min(1).max(200), qty: z.number().int().min(1).max(100_000), price: z.number().min(0).max(100_000_000) })).min(1).max(30),
  notes: z.string().trim().max(1000),
  text: z.string().trim().min(1).max(5000),
});

export async function sendQuote(raw: z.input<typeof input>): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const t = await getDictionary();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: t.quote.errors.invalid };
  const q = parsed.data;
  const db = await createClient();
  const { data: lead } = await db.from("sales_leads").select("id, stage, email").eq("id", q.leadId).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!lead) return { ok: false, error: t.ws.crm.errors.notFound };
  if (!lead.email) return { ok: false, error: t.quote.errors.noEmail };
  const sent = await sendReply(lead.id, q.text);
  if (!sent.ok) return sent;
  const total = q.lines.reduce((s, l) => s + l.qty * l.price, 0);
  await db.from("sales_leads").update({ deal_value: total, deal_currency: q.currency }).eq("id", lead.id);
  await db.from("lead_activities").insert({
    workspace_id: session.workspace.id, lead_id: lead.id, kind: "note", actor_id: session.userId, actor_kind: "user",
    body: q.text.slice(0, 4000), meta: { quote: { lines: q.lines, total, currency: q.currency, notes: q.notes } },
  });
  if (["interested", "meeting_booked", "meeting_completed"].includes(lead.stage)) await changeStage(db, session.workspace.id, lead.id, "proposal", "user");
  revalidatePath(`/crm/${lead.id}`);
  revalidatePath("/inbox");
  return { ok: true };
}
