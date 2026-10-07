// §106 — the most important end-to-end test (docs/bos/25-testing.md).
// Lead → Deal → Proposal → Contract → Won → Payment schedule → Payments →
// Account 360 → Upsell, through the real services against the
// LOCAL database. Created records are tagged "[E2E]" and archived at the end.
import { test } from "node:test";
import assert from "node:assert/strict";
import "@/services/bos/approval-handlers";
import { db } from "@/lib/bos/db";
import { dispatchPendingEvents } from "@/lib/bos/events";
import { getPipeline } from "@/services/bos/shared";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { createLead, assignLeads, changeLeadStage, convertLeadToDeal } from "@/services/bos/leads";
import { createActivity } from "@/services/bos/activities";
import { scheduleMeeting } from "@/services/bos/meetings";
import { changeDealStage, markDealWon, updateDeal, getDeal } from "@/services/bos/deals";
import { createProposalFromDeal, saveCommercialTerms, sendProposal, acceptProposal } from "@/services/bos/proposal-lifecycle";
import { createContract, sendContract, recordSignature, attachContractFile } from "@/services/bos/contracts";
import { recordPayment, invoiceFromSchedule } from "@/services/bos/finance";
import { hrEditSession } from "@/services/bos/attendance";
import { getAccount360, listUpsellOpportunities, archiveAccount } from "@/services/bos/accounts";

const events = async (entityId: string) => ((await db().from("activity_events").select("event_type").eq("entity_id", entityId)).data ?? []).map((e) => e.event_type);

test("§106 full business lifecycle", async () => {
  const c = db();
  const bd = await bosUserFor("ahmed@taysonsta.local");
  const sm = await bosUserFor("sales.manager@taysonsta.local");
  const finance = await bosUserFor("finance@taysonsta.local");
  const admin = await bosUserFor("admin@taysonsta.local");
  const hr = await bosUserFor("hr@taysonsta.local");
  const tag = uniq("e2e");
  const email = `${tag}@lifecycle.test`;
  const { stages: leadStages } = await getPipeline("lead");
  const stage = (key: string) => leadStages.find((s) => s.key === key)!.id;

  // 1. BD creates Lead
  const lead = await createLead(bd, { name: `[E2E] Acme ${tag}`, company_name: `[E2E] Acme ${tag}`, contact_name: "Omar Acme", email, phone: "+201000000000", website: null, country: "Egypt", city: "Cairo", industry: "Education", source_id: null, estimated_budget: "25000", budget_currency: "USD", business_stage: null, timeline: null, decision_maker: "Omar", current_solution: null, problem: "Needs an LMS", notes: null, assigned_to: null, team_id: null, priority: "high", budget_score: 20, fit_score: 20, intent_score: 20, engagement_score: 15 });
  await dispatchPendingEvents();
  assert.ok((await events(lead.id)).includes("lead.created"), "1. lead.created");

  // 2. Assigned to BD → lead.assigned + notification
  await assignLeads(sm, [lead.id], bd.userId);
  await dispatchPendingEvents();
  assert.ok((await events(lead.id)).includes("lead.assigned"), "2. lead.assigned");
  const { data: notif } = await c.from("bos_notifications").select("id").eq("user_id", bd.userId).eq("entity_id", lead.id);
  assert.ok((notif ?? []).length > 0, "2. BD notified");

  // 3–5. Contacted (outbound), replied (inbound), qualified
  await createActivity(bd, { type: "email", title: "Intro email", description: null, direction: "outbound", outcome: null, lead_id: lead.id, deal_id: null, client_id: null, contact_id: null, assigned_to: bd.userId, priority: "medium", status: "completed", due_at: null, start_at: null, reminder_at: null });
  await changeLeadStage(bd, lead.id, stage("contacted"));
  await createActivity(bd, { type: "email", title: "Client replied", description: null, direction: "inbound", outcome: null, lead_id: lead.id, deal_id: null, client_id: null, contact_id: null, assigned_to: bd.userId, priority: "medium", status: "completed", due_at: null, start_at: null, reminder_at: null });
  await changeLeadStage(bd, lead.id, stage("replied"));
  await dispatchPendingEvents();
  assert.ok((await events(lead.id)).includes("lead.replied"), "4. lead.replied");
  await changeLeadStage(bd, lead.id, stage("qualified"));

  // 6. Discovery meeting
  const meeting = await scheduleMeeting(bd, { title: "Discovery", lead_id: lead.id, deal_id: null, client_id: null, contact_id: null, start_at: new Date(Date.now() + 86400_000).toISOString(), duration_minutes: 45, meeting_link: null, location: null, notes: null, attendee_user_ids: [], attendee_contact_ids: [], attendee_emails: [] });
  assert.ok(meeting, "6. meeting created");
  if (leadStages.some((s) => s.key === "meeting")) await changeLeadStage(bd, lead.id, stage("meeting"));

  // 7. Convert to a $25,000 deal (links account/contact/lead)
  const dealId = await convertLeadToDeal(bd, lead.id, { clientId: null, newClientName: `[E2E] Acme ${tag}`, newClientEmail: email, contactId: null, dealName: `[E2E] Acme LMS ${tag}`, value: "25000", currency: "USD", expectedCloseDate: null });
  const deal = await getDeal(dealId);
  assert.equal(deal.lead_id, lead.id, "7. deal linked to lead");
  assert.ok(deal.client_id && deal.contact_id, "7. account + contact linked");
  const clientId = deal.client_id as string;

  // 8–9. Proposal 40/30/30 → sent
  const proposalId = await createProposalFromDeal(bd, dealId, `[E2E] Proposal ${tag}`);
  await saveCommercialTerms(bd, proposalId, { total_amount: "25000", currency: "USD", schedule: [{ label: "Deposit", percent: "40" }, { label: "Milestone", percent: "30" }, { label: "Final", percent: "30" }], valid_until: new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10), assumptions: null, terms: null });
  const { createProposalAccess } = await import("@/services/proposal-access");
  await createProposalAccess(proposalId, `proposal-${tag}@lifecycle.test`, `E2e!${tag}Pass`);
  const sent = await sendProposal(bd, proposalId);
  assert.deepEqual(sent.errors, [], `9. proposal sent: ${sent.errors.join("; ")}`);
  await dispatchPendingEvents();
  assert.ok((await events(proposalId)).includes("proposal.sent"), "9. proposal.sent");

  // 10. Client accepts
  await acceptProposal(proposalId, { userId: bd.userId, onBehalf: true });
  await dispatchPendingEvents();
  assert.ok((await events(proposalId)).includes("proposal.accepted"), "10. proposal.accepted");

  // Payment terms on the deal = 40/30/30 (required for Won)
  const d2 = await getDeal(dealId);
  if (!((d2.payment_terms as unknown[]) ?? []).length) {
    await updateDeal(bd, dealId, { name: d2.name, client_id: clientId, contact_id: d2.contact_id, lead_id: d2.lead_id, source_id: d2.source_id, value: "25000", currency: "USD", probability: null, expected_close_date: null, assigned_to: bd.userId, scope: "LMS", notes: null, payment_terms: [{ label: "Deposit", percent: 40, trigger: "on_signing" }, { label: "Second", percent: 30, trigger: "on_date", due_offset_days: 15 }, { label: "Final", percent: 30, trigger: "on_date", due_offset_days: 45 }] as never });
  }

  // 11. Contract signed
  const contract = await createContract(bd, { title: `[E2E] Contract ${tag}`, client_id: clientId, deal_id: dealId, proposal_id: proposalId, value: "25000", currency: "USD", start_date: null, end_date: null, payment_terms: "40/30/30", required_signers: 1 });
  const { data: cfile } = await c.from("files").insert({ storage_path: `contract/${contract.id}/${tag}.pdf`, name: "contract.pdf", mime_type: "application/pdf", entity_type: "contract", entity_id: contract.id, uploaded_by: bd.userId, is_finalized: true }).select("id").single();
  await attachContractFile(bd, contract.id, cfile!.id);
  await sendContract(bd, contract.id);
  await recordSignature({ userId: bd.userId, actorType: "user" }, contract.id, { signer_name: "Omar Acme", signer_email: email, contact_id: deal.contact_id, user_id: null, method: "manual", provider_reference: null, ip: null });
  await dispatchPendingEvents();
  assert.ok((await events(contract.id)).includes("contract.signed"), "11. contract.signed");

  // 12–13. Won → account, schedule, first invoice, commission, onboarding; idempotent
  await markDealWon(bd, dealId);
  await markDealWon(bd, dealId);
  const { data: client } = await c.from("clients").select("account_status").eq("id", clientId).single();
  assert.equal(client!.account_status, "active", "13. client active");
  const { data: schedule } = await c.from("payment_schedules").select("id, amount, sort_order, trigger, status").eq("deal_id", dealId).order("sort_order");
  assert.equal(schedule?.length, 3, "13. 3 schedule rows");
  assert.deepEqual(schedule!.map((s) => Number(s.amount)), [10000, 7500, 7500], "13. 40/30/30");
  const { data: invoices } = await c.from("bos_invoices").select("id, total, status").eq("deal_id", dealId);
  assert.equal(invoices?.length, 1, "13. first invoice, not duplicated");
  assert.equal(Number(invoices![0].total), 10000);
  const { count: onboarding } = await c.from("onboarding_checklists").select("id", { count: "exact", head: true }).eq("deal_id", dealId);
  assert.equal(onboarding, 1, "13. client onboarding started");
  const { count: commissions } = await c.from("commissions").select("id", { count: "exact", head: true }).eq("deal_id", dealId);
  assert.ok((commissions ?? 0) >= 1, "13. commission created");
  const { data: finNotif } = await c.from("bos_notifications").select("id").eq("user_id", finance.userId).eq("entity_id", dealId);
  assert.ok((finNotif ?? []).length > 0, "13. Finance notified");

  // 14. Client pays $10,000
  await recordPayment(finance, { client_id: clientId, invoice_id: invoices![0].id, deal_id: dealId, amount: "10000", currency: "USD", method: "bank_transfer", payment_date: new Date().toISOString().slice(0, 10), reference: tag, status: "completed", notes: null, idempotency_key: `e2e-${tag}-1` });
  const { data: inv1 } = await c.from("bos_invoices").select("status, balance").eq("id", invoices![0].id).single();
  assert.equal(inv1!.status, "paid", "14. invoice paid");
  const { data: dealAfterPay } = await c.from("deals").select("payment_status, value").eq("id", dealId).single();
  assert.equal(dealAfterPay!.payment_status, "partially_paid", "14. deal partially paid");
  const { data: paid } = await c.from("bos_payments").select("amount, refunded_amount").eq("deal_id", dealId).eq("status", "completed");
  const collected = (paid ?? []).reduce((s, p) => s + Number(p.amount) - Number(p.refunded_amount), 0);
  assert.equal(collected, 10000, "14. collected 10,000");
  assert.equal(Number(dealAfterPay!.value) - collected, 15000, "14. outstanding 15,000");

  // 17. Attendance
  await hrEditSession(hr, { user_id: bd.userId, work_date: "2026-01-12", session_id: null, clock_in_at: "2026-01-12T08:00:00Z", clock_out_at: "2026-01-12T16:00:00Z", reason: "E2E attendance" });
  const { data: att } = await c.from("attendance_records").select("id, worked_minutes").eq("user_id", bd.userId).eq("work_date", "2026-01-12").single();
  assert.equal(att!.worked_minutes, 480, "17. attendance worked minutes");
  await c.from("attendance_records").delete().eq("id", att!.id);

  // Remaining invoices paid
  const { data: openSched } = await c.from("payment_schedules").select("id, invoice_id").eq("deal_id", dealId).order("sort_order");
  let n = 2;
  for (const s of openSched ?? []) {
    const invId = s.invoice_id ?? (await invoiceFromSchedule(finance, s.id));
    const { data: inv } = await c.from("bos_invoices").select("status, balance").eq("id", invId).single();
    if (inv!.status === "draft") await c.from("bos_invoices").update({ status: "sent" }).eq("id", invId);
    if (Number(inv!.balance) > 0) await recordPayment(finance, { client_id: clientId, invoice_id: invId, deal_id: dealId, amount: String(inv!.balance), currency: "USD", method: "bank_transfer", payment_date: new Date().toISOString().slice(0, 10), reference: tag, status: "completed", notes: null, idempotency_key: `e2e-${tag}-${n++}` });
  }

  const { data: dealPaid } = await c.from("deals").select("payment_status").eq("id", dealId).single();
  assert.equal(dealPaid!.payment_status, "paid", "18. deal fully paid");

  // 21–22. Account remains active and 360 shows everything
  const a360 = await getAccount360(clientId);
  assert.equal(a360.account.account_status, "active", "21. account active");
  assert.ok(a360.revenue.some((r) => r.currency === "USD" && Number(r.amount) === 25000), "22. revenue 25,000");
  assert.ok(a360.counts.contracts >= 1 && a360.counts.invoices >= 3 && a360.counts.payments >= 3, "22. contracts/invoices/payments");
  const ups = await listUpsellOpportunities(clientId);
  assert.ok(ups.won.some((d) => d.id === dealId), "22. upsell opportunity");

  // 23. Upsell opportunity becomes a Deal
  const { createDeal } = await import("@/services/bos/deals");
  const upsell = await createDeal(bd, { name: `[E2E] Upsell ${tag}`, client_id: clientId, contact_id: deal.contact_id, lead_id: null, source_id: null, value: "6000", currency: "USD", probability: null, expected_close_date: null, assigned_to: bd.userId, scope: "Phase 2", notes: null, payment_terms: [{ label: "Full", percent: 100 }] as never, is_upsell: true, previous_deal_id: dealId });
  const { data: u } = await c.from("deals").select("is_upsell, previous_deal_id").eq("id", upsell.id).single();
  assert.deepEqual(u, { is_upsell: true, previous_deal_id: dealId }, "23. upsell deal linked");

  // Tidy: archive the E2E upsell deal and account so demo data stays clean.
  await c.from("deals").update({ archived_at: new Date().toISOString() }).eq("id", upsell.id);
  await archiveAccount(admin, clientId, true);
  await changeDealStage(bd, dealId, deal.stage_id).catch(() => undefined);
});
