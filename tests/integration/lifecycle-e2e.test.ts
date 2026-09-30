// §106 — the most important end-to-end test (docs/bos/25-testing.md).
// Lead → Deal → Proposal → Contract → Won → Project → Payment → Delivery →
// Completion → Account 360 → Upsell, through the real services against the
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
import { changeDealStage, markDealWon, updateDeal, getDeal, getDealProducts } from "@/services/bos/deals";
import { createProposalFromDeal, saveCommercialTerms, sendProposal, acceptProposal } from "@/services/bos/proposal-lifecycle";
import { createContract, sendContract, recordSignature, attachContractFile } from "@/services/bos/contracts";
import { recordPayment, invoiceFromSchedule } from "@/services/bos/finance";
import { changeProjectStatus, completeProject, requestFinalApproval, completionBlockers } from "@/services/bos/projects";
import { logTime, setTaskStatus, setMilestoneStatus } from "@/services/bos/delivery";
import { hrEditSession } from "@/services/bos/attendance";
import { decideApproval } from "@/services/bos/approvals";
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
  const lead = await createLead(bd, { name: `[E2E] Acme ${tag}`, company_name: `[E2E] Acme ${tag}`, contact_name: "Omar Acme", email, phone: "+201000000000", website: null, country: "Egypt", city: "Cairo", industry: "Education", source_id: null, estimated_budget: "25000", budget_currency: "USD", product_interest_id: null, business_stage: null, timeline: null, decision_maker: "Omar", current_solution: null, problem: "Needs an LMS", notes: null, assigned_to: null, team_id: null, priority: "high", budget_score: 20, fit_score: 20, intent_score: 20, engagement_score: 15 });
  await dispatchPendingEvents();
  assert.ok((await events(lead.id)).includes("lead.created"), "1. lead.created");

  // 2. Assigned to BD → lead.assigned + notification
  await assignLeads(sm, [lead.id], bd.userId);
  await dispatchPendingEvents();
  assert.ok((await events(lead.id)).includes("lead.assigned"), "2. lead.assigned");
  const { data: notif } = await c.from("notifications").select("id").eq("user_id", bd.userId).eq("entity_id", lead.id);
  assert.ok((notif ?? []).length > 0, "2. BD notified");

  // 3–5. Contacted (outbound), replied (inbound), qualified
  await createActivity(bd, { type: "email", title: "Intro email", description: null, direction: "outbound", outcome: null, lead_id: lead.id, deal_id: null, client_id: null, contact_id: null, project_id: null, assigned_to: bd.userId, priority: "medium", status: "completed", due_at: null, start_at: null, reminder_at: null });
  await changeLeadStage(bd, lead.id, stage("contacted"));
  await createActivity(bd, { type: "email", title: "Client replied", description: null, direction: "inbound", outcome: null, lead_id: lead.id, deal_id: null, client_id: null, contact_id: null, project_id: null, assigned_to: bd.userId, priority: "medium", status: "completed", due_at: null, start_at: null, reminder_at: null });
  await changeLeadStage(bd, lead.id, stage("replied"));
  await dispatchPendingEvents();
  assert.ok((await events(lead.id)).includes("lead.replied"), "4. lead.replied");
  await changeLeadStage(bd, lead.id, stage("qualified"));

  // 6. Discovery meeting
  const meeting = await scheduleMeeting(bd, { title: "Discovery", lead_id: lead.id, deal_id: null, client_id: null, contact_id: null, project_id: null, start_at: new Date(Date.now() + 86400_000).toISOString(), duration_minutes: 45, meeting_link: null, location: null, notes: null, attendee_user_ids: [], attendee_contact_ids: [], attendee_emails: [] });
  assert.ok(meeting, "6. meeting created");
  if (leadStages.some((s) => s.key === "meeting")) await changeLeadStage(bd, lead.id, stage("meeting"));

  // 7. Convert to a $25,000 deal (links account/contact/lead)
  const dealId = await convertLeadToDeal(bd, lead.id, { clientId: null, newClientName: `[E2E] Acme ${tag}`, newClientEmail: email, contactId: null, dealName: `[E2E] Acme LMS ${tag}`, value: "25000", currency: "USD", expectedCloseDate: null, productId: null });
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
  const products = await getDealProducts(dealId);
  if (!((d2.payment_terms as unknown[]) ?? []).length) {
    await updateDeal(bd, dealId, { name: d2.name, client_id: clientId, contact_id: d2.contact_id, lead_id: d2.lead_id, source_id: d2.source_id, value: "25000", currency: "USD", probability: null, expected_close_date: null, assigned_to: bd.userId, scope: "LMS", notes: null, payment_terms: [{ label: "Deposit", percent: 40, trigger: "on_signing" }, { label: "Milestone", percent: 30, trigger: "on_milestone" }, { label: "Final", percent: 30, trigger: "on_completion" }] as never, products: products.map((p) => ({ product_id: p.product_id as string, quantity: String(p.quantity), unit_price: String(p.unit_price) })) });
  }

  // 11. Contract signed
  const contract = await createContract(bd, { title: `[E2E] Contract ${tag}`, client_id: clientId, deal_id: dealId, proposal_id: proposalId, value: "25000", currency: "USD", start_date: null, end_date: null, payment_terms: "40/30/30", required_signers: 1 });
  const { data: cfile } = await c.from("files").insert({ storage_path: `contract/${contract.id}/${tag}.pdf`, name: "contract.pdf", mime_type: "application/pdf", entity_type: "contract", entity_id: contract.id, uploaded_by: bd.userId, is_finalized: true }).select("id").single();
  await attachContractFile(bd, contract.id, cfile!.id);
  await sendContract(bd, contract.id);
  await recordSignature({ userId: bd.userId, actorType: "user" }, contract.id, { signer_name: "Omar Acme", signer_email: email, contact_id: deal.contact_id, user_id: null, method: "manual", provider_reference: null, ip: null });
  await dispatchPendingEvents();
  assert.ok((await events(contract.id)).includes("contract.signed"), "11. contract.signed");

  // 12–13. Won → automatic delivery setup; idempotent
  const projectId = await markDealWon(bd, dealId);
  assert.ok(projectId, "12. won returns project");
  const again = await markDealWon(bd, dealId);
  assert.equal(again, projectId, "13. idempotent: same project");
  const { count: projectCount } = await c.from("projects").select("id", { count: "exact", head: true }).eq("deal_id", dealId);
  assert.equal(projectCount, 1, "13. exactly one project");
  const { data: client } = await c.from("clients").select("account_status").eq("id", clientId).single();
  assert.equal(client!.account_status, "active", "13. client active");
  const { data: project } = await c.from("projects").select("*").eq("id", projectId!).single();
  assert.ok(project!.pm_id, "13. PM assigned");
  const { data: schedule } = await c.from("payment_schedules").select("id, amount, sort_order, trigger, status").eq("deal_id", dealId).order("sort_order");
  assert.equal(schedule?.length, 3, "13. 3 schedule rows");
  assert.deepEqual(schedule!.map((s) => Number(s.amount)), [10000, 7500, 7500], "13. 40/30/30");
  const { data: invoices } = await c.from("invoices").select("id, total, status").eq("deal_id", dealId);
  assert.equal(invoices?.length, 1, "13. first invoice");
  assert.equal(Number(invoices![0].total), 10000);
  const { count: ms } = await c.from("milestones").select("id", { count: "exact", head: true }).eq("project_id", projectId!);
  const { count: ts } = await c.from("tasks").select("id", { count: "exact", head: true }).eq("project_id", projectId!);
  assert.ok((ms ?? 0) > 0 && (ts ?? 0) > 0, "13. milestones + tasks");
  const { count: onboarding } = await c.from("onboarding_checklists").select("id", { count: "exact", head: true }).eq("deal_id", dealId);
  assert.equal(onboarding, 1, "13. client onboarding started");
  const { count: commissions } = await c.from("commissions").select("id", { count: "exact", head: true }).eq("deal_id", dealId);
  assert.ok((commissions ?? 0) >= 1, "13. commission created");
  const { data: finNotif } = await c.from("notifications").select("id").eq("user_id", finance.userId).eq("entity_id", dealId);
  assert.ok((finNotif ?? []).length > 0, "13. Finance notified");

  // 14. Client pays $10,000
  await recordPayment(finance, { client_id: clientId, invoice_id: invoices![0].id, deal_id: dealId, project_id: projectId, amount: "10000", currency: "USD", exchange_rate: null, method: "bank_transfer", payment_date: new Date().toISOString().slice(0, 10), reference: tag, status: "completed", notes: null, idempotency_key: `e2e-${tag}-1` });
  const { data: inv1 } = await c.from("invoices").select("status, balance").eq("id", invoices![0].id).single();
  assert.equal(inv1!.status, "paid", "14. invoice paid");
  const { data: dealAfterPay } = await c.from("deals").select("payment_status, value").eq("id", dealId).single();
  assert.equal(dealAfterPay!.payment_status, "partially_paid", "14. deal partially paid");
  const { data: paid } = await c.from("payments").select("amount, refunded_amount").eq("deal_id", dealId).eq("status", "completed");
  const collected = (paid ?? []).reduce((s, p) => s + Number(p.amount) - Number(p.refunded_amount), 0);
  assert.equal(collected, 10000, "14. collected 10,000");
  assert.equal(Number(dealAfterPay!.value) - collected, 15000, "14. outstanding 15,000");

  // 16–17. Time entries and attendance
  const pm = await bosUserFor((await c.from("employees").select("email").eq("user_id", project!.pm_id).single()).data!.email as string);
  const { data: firstTask } = await c.from("tasks").select("id").eq("project_id", projectId!).order("sort_order").limit(1).single();
  await logTime(pm, { user_id: pm.userId, project_id: projectId, task_id: firstTask!.id, started_at: new Date(Date.now() - 3 * 3600_000).toISOString(), ended_at: new Date(Date.now() - 3600_000).toISOString(), description: "Setup", billable: true });
  const { data: te } = await c.from("time_entries").select("duration_minutes").eq("project_id", projectId!);
  assert.equal(te?.[0]?.duration_minutes, 120, "16. time recorded");
  await hrEditSession(hr, { user_id: pm.userId, work_date: "2026-01-12", session_id: null, clock_in_at: "2026-01-12T08:00:00Z", clock_out_at: "2026-01-12T16:00:00Z", reason: "E2E attendance" });
  const { data: att } = await c.from("attendance_records").select("id, worked_minutes").eq("user_id", pm.userId).eq("work_date", "2026-01-12").single();
  assert.equal(att!.worked_minutes, 480, "17. attendance worked minutes");
  await c.from("attendance_records").delete().eq("id", att!.id);

  // 15. Status progression; 18. tasks & milestones completed
  for (const to of ["design", "development", "qa", "client_review", "launch"] as const) await changeProjectStatus(pm, projectId!, to);
  // Complete tasks through the service, respecting dependencies (retry rounds).
  for (let round = 0; round < 10; round++) {
    const { data: open } = await c.from("tasks").select("id, status").eq("project_id", projectId!).is("archived_at", null).not("status", "in", "(completed,cancelled)");
    if (!open?.length) break;
    for (const t of open) {
      try {
        if (t.status !== "in_progress") await setTaskStatus(pm, t.id, "in_progress");
        await setTaskStatus(pm, t.id, "completed");
      } catch {
        // blocked by a dependency — completed in a later round
      }
    }
  }
  const { count: openTasks } = await c.from("tasks").select("id", { count: "exact", head: true }).eq("project_id", projectId!).is("archived_at", null).not("status", "in", "(completed,cancelled)");
  assert.equal(openTasks, 0, "18. all tasks completed via service");
  const { data: milestones } = await c.from("milestones").select("id, status, requires_client_approval").eq("project_id", projectId!).order("sort_order");
  for (const m of milestones ?? []) {
    if (m.requires_client_approval) await c.from("milestones").update({ approval_status: "approved" }).eq("id", m.id); // client milestone approvals (portal flow tested separately)
    if (m.status === "not_started") await setMilestoneStatus(pm, m.id, "in_progress");
    if (m.status !== "completed") await setMilestoneStatus(pm, m.id, "completed");
  }
  await c.rpc("bos_recompute_project_progress", { p_project: projectId! });
  const { data: prog } = await c.from("projects").select("progress").eq("id", projectId!).single();
  assert.equal(prog!.progress, 100, "18. progress 100");

  // Remaining invoices paid (completion gate requires final payment)
  const { data: openSched } = await c.from("payment_schedules").select("id, invoice_id").eq("deal_id", dealId).order("sort_order");
  let n = 2;
  for (const s of openSched ?? []) {
    const invId = s.invoice_id ?? (await invoiceFromSchedule(finance, s.id));
    const { data: inv } = await c.from("invoices").select("status, balance").eq("id", invId).single();
    if (inv!.status === "draft") await c.from("invoices").update({ status: "sent" }).eq("id", invId);
    if (Number(inv!.balance) > 0) await recordPayment(finance, { client_id: clientId, invoice_id: invId, deal_id: dealId, project_id: projectId, amount: String(inv!.balance), currency: "USD", exchange_rate: null, method: "bank_transfer", payment_date: new Date().toISOString().slice(0, 10), reference: tag, status: "completed", notes: null, idempotency_key: `e2e-${tag}-${n++}` });
  }

  // 19. Client approves final delivery (as the client contact)
  await requestFinalApproval(pm, projectId!);
  const { data: fa } = await c.from("approvals").select("*").eq("entity_type", "project").eq("entity_id", projectId!).eq("approval_type", "final_delivery").eq("status", "pending").maybeSingle();
  assert.ok(fa, "19. final delivery approval requested");
  const decided = await decideApproval(fa!.id, "approved", "Great work", { bos: null, contactId: fa!.approver_contact_id });
  assert.equal(decided.decided_by_contact_id, fa!.approver_contact_id, "19. decided by client contact");

  // 20. Project completed; status history ≥ 6
  const blockers = await completionBlockers(projectId!);
  assert.deepEqual(blockers, [], `20. no completion blockers: ${blockers.join(", ")}`);
  await completeProject(pm, projectId!);
  const { data: done } = await c.from("projects").select("status").eq("id", projectId!).single();
  assert.equal(done!.status, "completed", "20. completed");
  const { count: hist } = await c.from("status_history").select("id", { count: "exact", head: true }).eq("entity_type", "project").eq("entity_id", projectId!);
  assert.ok((hist ?? 0) >= 6, "15. status history ≥ 6");

  // 21–22. Account remains active and 360 shows everything
  const a360 = await getAccount360(clientId);
  assert.equal(a360.account.account_status, "active", "21. account active");
  assert.equal(a360.counts.projects, 1, "22. previous project");
  assert.ok(a360.revenue.some((r) => r.currency === "USD" && Number(r.amount) === 25000), "22. revenue 25,000");
  assert.ok(a360.counts.contracts >= 1 && a360.counts.invoices >= 3 && a360.counts.payments >= 3, "22. contracts/invoices/payments");
  const ups = await listUpsellOpportunities(clientId);
  assert.ok(ups.completed.some((p) => p.id === projectId), "22. upsell opportunity");

  // 23. Upsell opportunity becomes a Deal
  const { createDeal } = await import("@/services/bos/deals");
  const upsell = await createDeal(bd, { name: `[E2E] Upsell ${tag}`, client_id: clientId, contact_id: deal.contact_id, lead_id: null, source_id: null, value: "6000", currency: "USD", probability: null, expected_close_date: null, assigned_to: bd.userId, scope: "Phase 2", notes: null, payment_terms: [{ label: "Full", percent: 100 }] as never, products: [], is_upsell: true, previous_project_id: projectId, previous_deal_id: dealId });
  const { data: u } = await c.from("deals").select("is_upsell, previous_project_id, previous_deal_id").eq("id", upsell.id).single();
  assert.deepEqual(u, { is_upsell: true, previous_project_id: projectId, previous_deal_id: dealId }, "23. upsell deal linked");

  // Tidy: archive the E2E upsell deal and account so demo data stays clean.
  await c.from("deals").update({ archived_at: new Date().toISOString() }).eq("id", upsell.id);
  await archiveAccount(admin, clientId, true);
  await changeDealStage(bd, dealId, deal.stage_id).catch(() => undefined);
});
