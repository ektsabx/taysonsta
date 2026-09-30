// HR & Workforce integration tests (docs/bos/28 §45 acceptance criteria).
// Real services against the LOCAL database; far-future dates keep them apart
// from demo data, and every row created here is removed afterwards.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import "@/services/bos/approval-handlers";
import { db } from "@/lib/bos/db";
import { canAccessEntity } from "@/lib/bos/access";
import { nowIso } from "@/lib/bos/clock";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { createEmployee, changeLifecycleStatus } from "@/services/bos/employees";
import { listEmployeeChecklists } from "@/services/bos/onboarding";
import { decideApproval } from "@/services/bos/approvals";
import { getBalances, addBalanceAdjustment, requestLeave } from "@/services/bos/leave";
import { saveSchedule } from "@/services/bos/hr/schedules";
import { addCompensation, setEmployeeComponent, listJobHistory } from "@/services/bos/hr/people";
import { createDocument, createContract, contractAction, renewContract, runHrExpirySweep } from "@/services/bos/hr/documents";
import { createRun, calculateRun, submitRun, publishPayslips, markRunPaid, getRun } from "@/services/bos/hr/payroll";
import { requestBonus, requestLoan, disburseLoan, submitExpenseClaim, reimburseDirectly, submitHrRequest, progressHrRequest } from "@/services/bos/hr/requests";
import { createManualApplication, scheduleInterview, submitFeedback, createOffer, sendOffer, respondOffer, hireCandidate } from "@/services/bos/hr/recruitment";
import { runHrReport } from "@/services/bos/hr/reports";
import { getHrOverview } from "@/services/bos/hr/dashboard";
import { ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});

async function decideAll(entityType: string, entityId: string, decision: "approved" | "rejected" = "approved") {
  const admin = await bosUserFor("admin@taysonsta.local");
  for (let i = 0; i < 6; i++) {
    const { data } = await db().from("approvals").select("id").eq("entity_type", entityType).eq("entity_id", entityId).eq("status", "pending").limit(1).maybeSingle();
    if (!data) return;
    await decideApproval(data.id, decision, decision === "rejected" ? "no" : null, { bos: admin });
  }
}

async function removeEmployee(id: string) {
  const c = db();
  const { data: docs } = await c.from("employee_documents").select("id").eq("employee_id", id);
  for (const d of docs ?? []) await c.from("files").delete().eq("entity_id", d.id);
  await c.from("onboarding_checklists").delete().eq("employee_id", id);
  await c.from("access_grants").delete().eq("employee_id", id);
  await c.from("access_requests").delete().eq("employee_id", id);
  await c.from("company_accounts").delete().eq("employee_id", id);
  const { error } = await c.from("employees").delete().eq("id", id);
  if (error) throw error;
}

async function testEmployee(hr: Awaited<ReturnType<typeof bosUserFor>>, extra: Partial<Parameters<typeof createEmployee>[1]> = {}) {
  const name = uniq("HR Test");
  const emp = await createEmployee(hr, { full_name: name, employee_code: null, email: null, personal_email: null, phone: "+20100", position: "Tester", department_id: null, team_id: null, manager_id: hr.employee.id, start_date: "2031-01-01", employment_type: "full_time", work_schedule_id: null, country: "Egypt", timezone: "Africa/Cairo", is_remote: false, hourly_cost: null, cost_currency: null, ...extra }, { roleIds: [], createLogin: false });
  cleanup.push(async () => {
    const c = db();
    const { data: runs } = await c.from("payslips").select("run_id").eq("employee_id", emp.id);
    for (const r of runs ?? []) {
      await c.from("expenses").delete().eq("source_type", "payslip").in("source_id", (await c.from("payslips").select("id").eq("run_id", r.run_id)).data?.map((x) => x.id) ?? []);
      await c.from("approvals").delete().eq("entity_id", r.run_id);
      await c.from("payroll_runs").delete().eq("id", r.run_id);
    }
    for (const t of ["employee_loans", "employee_bonuses"] as const) {
      const { data } = await c.from(t).select("id").eq("employee_id", emp.id);
      for (const x of data ?? []) await c.from("approvals").delete().eq("entity_id", x.id);
      await c.from(t).delete().eq("employee_id", emp.id);
    }
    const { data: ks } = await c.from("employee_contracts").select("id").eq("employee_id", emp.id);
    for (const k of ks ?? []) await c.from("files").delete().eq("entity_id", k.id);
    await c.from("employee_contracts").update({ parent_id: null }).eq("employee_id", emp.id);
    await c.from("employee_contracts").delete().eq("employee_id", emp.id);
    await c.from("approvals").delete().eq("entity_id", emp.id);
    await removeEmployee(emp.id);
  });
  return emp;
}

test("attendance: per-day schedule, late 17 / overtime 42 (spec example), day off, holiday", async () => {
  const hr = await bosUserFor("hr@taysonsta.local");
  const dev = await bosUserFor("youssef.dev@taysonsta.local");
  const c = db();
  const scheduleId = await saveSchedule(hr, null, {
    name: uniq("Spec 9-5"), schedule_type: "fixed", timezone: "Africa/Cairo", grace_minutes: 15, half_day_minutes: 240, overtime_after_minutes: 0, required_minutes: null, description: null, color: null, is_active: true,
    days: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ weekday: d, is_working: d <= 4, start_time: "09:00", end_time: "17:00", break_minutes: 0 })),
  });
  const dates = ["2031-03-02", "2031-03-03", "2031-03-07"]; // Sunday, Monday (holiday), Friday
  cleanup.push(async () => {
    await c.from("attendance_records").delete().eq("user_id", dev.userId).in("work_date", dates);
    await c.from("shift_assignments").delete().eq("schedule_id", scheduleId);
    await c.from("holidays").delete().eq("date", "2031-03-03");
    await c.from("work_schedules").delete().eq("id", scheduleId);
  });
  await c.from("shift_assignments").insert(dates.map((d) => ({ employee_id: dev.employee.id, work_date: d, schedule_id: scheduleId })));
  await c.from("holidays").insert({ date: "2031-03-03", name: "Test holiday", kind: "public" });

  const { data: rec } = await c.from("attendance_records").insert({ user_id: dev.userId, work_date: "2031-03-02", timezone: "Africa/Cairo" }).select("id").single();
  await c.from("attendance_sessions").insert({ record_id: rec!.id, user_id: dev.userId, clock_in_at: "2031-03-02T07:17:00Z", clock_out_at: "2031-03-02T15:42:00Z" });
  await c.rpc("bos_recalc_attendance_day", { p_record: rec!.id });
  const { data: day } = await c.from("attendance_records").select("*").eq("id", rec!.id).single();
  assert.equal(day!.late_minutes, 17, "check-in 09:17 vs 09:00 → 17 min late");
  assert.equal(day!.overtime_minutes, 42, "check-out 17:42 vs 17:00 → 42 min overtime");
  assert.equal(day!.status, "late");
  assert.equal(day!.expected_minutes, 480);
  assert.equal(day!.schedule_id, scheduleId, "date shift wins over every other assignment");

  for (const [date, expected] of [["2031-03-07", "day_off"], ["2031-03-03", "holiday"]] as const) {
    const { data: r } = await c.from("attendance_records").insert({ user_id: dev.userId, work_date: date, timezone: "Africa/Cairo" }).select("id").single();
    await c.rpc("bos_recalc_attendance_day", { p_record: r!.id });
    const { data: after } = await c.from("attendance_records").select("status").eq("id", r!.id).single();
    assert.equal(after!.status, expected, `${date} is ${expected}, not absent`);
  }
  const { data: works } = await c.rpc("bos_employee_work_days", { p_employee: dev.employee.id, p_from: "2031-03-02", p_to: "2031-03-07" });
  assert.ok(Number(works) >= 1);
});

test("leave: per-type approval rules and balance adjustments", async () => {
  const hr = await bosUserFor("hr@taysonsta.local");
  const sara = await bosUserFor("sara@taysonsta.local");
  const c = db();
  const { data: type } = await c.from("leave_types").select("*").eq("key", "casual").single();
  const { data: hrRole } = await c.from("roles").select("id").eq("key", "hr").single();
  await c.from("leave_types").update({ approval_steps: ["role:hr"], min_notice_days: null, max_consecutive_days: 5 }).eq("id", type!.id);
  cleanup.push(async () => {
    await c.from("leave_types").update({ approval_steps: type!.approval_steps, min_notice_days: type!.min_notice_days, max_consecutive_days: type!.max_consecutive_days }).eq("id", type!.id);
    const { data: lr } = await c.from("leave_requests").select("id").eq("user_id", sara.userId).gte("start_date", "2031-01-01");
    for (const l of lr ?? []) await c.from("approvals").delete().eq("entity_id", l.id);
    await c.from("leave_requests").delete().eq("user_id", sara.userId).gte("start_date", "2031-01-01");
    await c.from("leave_balance_adjustments").delete().eq("user_id", sara.userId).eq("year", 2031);
  });
  const before = (await getBalances(sara.userId, 2031)).find((b) => b.type.id === type!.id)!;
  await addBalanceAdjustment(hr, { user_id: sara.userId, leave_type_id: type!.id, year: 2031, days: 2, kind: "adjustment", reason: "test" });
  const afterAdj = (await getBalances(sara.userId, 2031)).find((b) => b.type.id === type!.id)!;
  assert.equal(afterAdj.allowance, (before.allowance ?? 0) + 2);

  const { leave } = await requestLeave(sara, sara.userId, { leave_type_id: type!.id, start_date: "2031-03-04", end_date: "2031-03-04", half_day: false, reason: null });
  const { data: approval } = await c.from("approvals").select("*").eq("entity_id", leave.id).eq("status", "pending").single();
  assert.equal(approval!.approver_role_id, hrRole!.id, "casual leave goes to HR per its approval rule");
  await assert.rejects(requestLeave(sara, sara.userId, { leave_type_id: type!.id, start_date: "2031-04-06", end_date: "2031-04-17", half_day: false, reason: null }), ValidationError, "max consecutive days enforced");
});

test("payroll end-to-end: salary + allowance + bonus + loan installment → approval → publish → paid in Finance", async () => {
  const hr = await bosUserFor("hr@taysonsta.local");
  const finance = await bosUserFor("finance@taysonsta.local");
  const c = db();
  const emp = await testEmployee(hr);
  await addCompensation(hr, emp.id, { effective_from: "2031-01-01", basic_salary: "22000", currency: "EGP", change_type: "initial", reason: null });
  const { data: transport } = await c.from("salary_components").select("id").eq("key", "transportation").single();
  await setEmployeeComponent(hr, { employee_id: emp.id, component_id: transport!.id, amount: "1500", effective_from: "2031-01-01", effective_to: null, notes: null });

  // Projects labor cost (§33): hourly cost can follow the salary.
  await c.from("employees").update({ hourly_cost_source: "salary" }).eq("id", emp.id);
  await c.rpc("bos_sync_hourly_cost", { p_employee: emp.id });
  const { data: cost } = await c.from("employees").select("hourly_cost, cost_currency").eq("id", emp.id).single();
  assert.equal(Number(cost!.hourly_cost), Number(((22000 + 1500) / 176).toFixed(3)), "(basic + fixed allowances) / standard monthly hours");
  assert.equal(cost!.cost_currency, "EGP");

  const bonus = await requestBonus(hr, { employee_id: emp.id, bonus_type: "performance", title: "Q2", amount: "2000", currency: "EGP", reason: "target", pay_period: "2031-05" });
  await decideAll("employee_bonus", bonus.id);
  // Loans need an active employee.
  await c.from("employees").update({ lifecycle_status: "active" }).eq("id", emp.id);
  const loan = await requestLoan(hr, { employee_id: emp.id, loan_type: "loan", amount: "30000", currency: "EGP", installments: 10, start_period: "2031-05", reason: "test" });
  const { data: plan } = await c.from("loan_installments").select("amount").eq("loan_id", loan.id);
  assert.equal(plan!.length, 10);
  assert.ok(plan!.every((p) => Number(p.amount) === 3000), "30,000 / 10 = 3,000 per month");
  await decideAll("employee_loan", loan.id);
  await disburseLoan(finance, loan.id, "TRX-1");

  const run = await createRun(hr, { run_type: "off_cycle", period: "2031-05", pay_date: "2031-05-31", department_id: null, employee_id: emp.id, notes: null });
  const calc = await calculateRun(hr, run.id);
  assert.equal(calc.count, 1);
  const { payslips } = await getRun(run.id);
  const slip = payslips[0];
  const { data: lines } = await c.from("payslip_lines").select("category, amount").eq("payslip_id", slip.id);
  const amount = (cat: string) => Number(lines!.find((l) => l.category === cat)?.amount ?? 0);
  assert.equal(amount("basic"), 22000);
  assert.equal(amount("transportation"), 1500);
  assert.equal(amount("bonus"), 2000);
  assert.equal(amount("loan"), 3000);
  assert.equal(Number(slip.net_pay), 22500, "22,000 + 1,500 + 2,000 − 3,000");

  await submitRun(hr, run.id);
  await decideAll("payroll_run", run.id);
  assert.equal((await getRun(run.id)).run.status, "approved");
  assert.equal(await publishPayslips(hr, run.id), 1);
  await markRunPaid(finance, run.id, { paid_on: "2031-05-31", reference: "BANK-1" });

  const { data: expense } = await c.from("expenses").select("amount, currency, approval_status, employee_user_id").eq("source_type", "payslip").eq("source_id", slip.id).single();
  assert.equal(Number(expense!.amount), 25500, "salary cost posted to Finance = earnings");
  assert.equal(expense!.approval_status, "approved");
  const { data: b } = await c.from("employee_bonuses").select("status").eq("id", bonus.id).single();
  assert.equal(b!.status, "paid");
  const { data: inst } = await c.from("loan_installments").select("status").eq("loan_id", loan.id).eq("seq", 1).single();
  assert.equal(inst!.status, "deducted");
  const { data: l } = await c.from("employee_loans").select("status").eq("id", loan.id).single();
  assert.equal(l!.status, "active", "9 installments remain");
});

test("recruitment: application → candidate → interview → feedback → offer → accepted → hired → employee (no re-entry)", async () => {
  const hr = await bosUserFor("hr@taysonsta.local");
  const omar = await bosUserFor("omar@taysonsta.local");
  const sara = await bosUserFor("sara@taysonsta.local");
  const c = db();
  const { data: job } = await c.from("career_jobs").select("id, title").order("created_at").limit(1).single();
  const email = `${uniq("cand").toLowerCase()}@example.test`;
  const app = await createManualApplication(hr, { job_id: job!.id, first_name: "Lina", last_name: "Test", email, phone: "+20111", country: "Egypt", source: "referral", years_experience: 3, expected_salary: "20000", notes: null });
  cleanup.push(async () => {
    const { data: cand } = await c.from("candidates").select("id, employee_id").eq("id", app.candidate_id as string).maybeSingle();
    const { data: ivs } = await c.from("career_interviews").select("meeting_id").eq("application_id", app.id);
    await c.from("job_offers").delete().eq("application_id", app.id);
    await c.from("career_interviews").delete().eq("application_id", app.id);
    for (const i of ivs ?? []) if (i.meeting_id) await c.from("meetings").delete().eq("id", i.meeting_id);
    if (cand?.employee_id) {
      await c.from("candidates").update({ employee_id: null }).eq("id", cand.id);
      await removeEmployee(cand.employee_id);
    }
    await c.from("career_applications").delete().eq("id", app.id);
    await c.from("candidates").delete().eq("id", app.candidate_id as string);
  });
  assert.ok(app.candidate_id, "candidate linked by trigger");

  const interviewId = await scheduleInterview(hr, null, { application_id: app.id, scheduled_at: "2031-02-01T10:00:00Z", duration_minutes: 45, round: 1, format: "video", interviewer_user_id: omar.userId, interviewer_name: null, meeting_link: null, location: null });
  const { data: iv } = await c.from("career_interviews").select("meeting_id").eq("id", interviewId).single();
  assert.ok(iv!.meeting_id, "interview is on the interviewer's calendar");
  const { data: moved } = await c.from("career_applications").select("status").eq("id", app.id).single();
  assert.equal(moved!.status, "interview");
  await submitFeedback(omar, interviewId, { rating: 4, recommendation: "yes", strengths: "clear", concerns: null, notes: null }, { canManage: false });
  await assert.rejects(submitFeedback(sara, interviewId, { rating: 1, recommendation: "no", strengths: null, concerns: null, notes: null }, { canManage: false }), ValidationError);

  const { data: transport } = await c.from("salary_components").select("id").eq("key", "transportation").single();
  const offer = await createOffer(hr, { application_id: app.id, position_title: "QA Engineer", department_id: null, team_id: null, manager_employee_id: omar.employee.id, employment_type: "full_time", start_date: "2031-06-01", basic_salary: "20000", currency: "EGP", allowances: [{ component_id: transport!.id, amount: "1000" }], probation_months: 3, expires_at: "2031-05-01", notes: null });
  assert.equal(await sendOffer(hr, offer.id), "sent");
  await respondOffer(hr, offer.id, "accepted", null);
  const emp = await hireCandidate(hr, { application_id: app.id, company_email: null, employee_code: null, timezone: "Africa/Cairo", create_login: false, role_ids: [] });

  assert.equal(emp.personal_email, email, "candidate data carried over");
  assert.equal(emp.position, "QA Engineer");
  assert.equal(emp.start_date, "2031-06-01");
  assert.equal(emp.manager_id, omar.employee.id);
  assert.equal(emp.probation_status, "in_probation");
  const { data: comp } = await c.from("employee_compensation").select("basic_salary, approval_status").eq("employee_id", emp.id).single();
  assert.equal(Number(comp!.basic_salary), 20000);
  assert.equal(comp!.approval_status, "approved");
  const { data: comps } = await c.from("employee_salary_components").select("amount").eq("employee_id", emp.id);
  assert.equal(Number(comps![0].amount), 1000);
  const { data: a } = await c.from("career_applications").select("status").eq("id", app.id).single();
  assert.equal(a!.status, "hired");
  const { data: cand } = await c.from("candidates").select("status, employee_id").eq("id", app.candidate_id as string).single();
  assert.equal(cand!.status, "hired");
  assert.equal(cand!.employee_id, emp.id);
  const [checklist] = await listEmployeeChecklists(emp.id);
  assert.ok(checklist.items.some((i) => i.auto_key === "offer_signed"), "onboarding starts with the HR items");
  assert.equal((await listJobHistory(emp.id))[0].change_type, "hire");
});

test("documents, payslips and contracts follow HR access rules; contract versions and expiry alerts", async () => {
  const hr = await bosUserFor("hr@taysonsta.local");
  const sara = await bosUserFor("sara@taysonsta.local");
  const ahmed = await bosUserFor("ahmed@taysonsta.local");
  const c = db();
  const { data: nid } = await c.from("document_types").select("id").eq("key", "national_id").single();
  const doc = await createDocument(hr, { employee_id: ahmed.employee.id, document_type_id: nid!.id, title: "NID test", document_number: "123", issue_date: null, expiry_date: "2032-01-01", confidential: false, notes: null }, { byEmployee: false });
  const secret = await createDocument(hr, { employee_id: ahmed.employee.id, document_type_id: nid!.id, title: "NID secret", document_number: null, issue_date: null, expiry_date: "2032-01-01", confidential: true, notes: null }, { byEmployee: false });
  cleanup.push(async () => { await c.from("employee_documents").delete().in("id", [doc.id, secret.id]); });
  assert.equal(await canAccessEntity(hr, "employee_document", doc.id), true);
  assert.equal(await canAccessEntity(ahmed, "employee_document", doc.id), true, "own, visible to employee");
  assert.equal(await canAccessEntity(sara, "employee_document", doc.id), false, "a colleague cannot read another person's ID");
  assert.equal(await canAccessEntity(ahmed, "employee_document", secret.id), false, "confidential stays with HR");
  assert.equal(await canAccessEntity(ahmed, "employee_document", doc.id, "update"), true, "pending document can be re-uploaded by its owner");

  const emp = await testEmployee(hr);
  const today = nowIso().slice(0, 10);
  const end = new Date(Date.parse(`${today}T00:00:00Z`) + 10 * 86400000).toISOString().slice(0, 10);
  const k = await createContract(hr, { employee_id: emp.id, contract_type: "employment", title: "Employment", start_date: "2026-01-01", end_date: end, position_title: "Tester", basic_salary: "20000", currency: "EGP", notice_period_days: 30, terms: null, notes: null, parent_id: null });
  await contractAction(hr, k.id, "sign_employee", null);
  await contractAction(hr, k.id, "sign_company", null);
  await assert.rejects(contractAction(hr, k.id, "activate", null), ValidationError, "signed copy must be uploaded first");
  await c.from("files").insert({ storage_path: `employee_contract/${k.id}/test.pdf`, name: "test.pdf", entity_type: "employee_contract", entity_id: k.id, is_finalized: true, uploaded_by: hr.userId });
  await contractAction(hr, k.id, "activate", null);
  assert.equal(await canAccessEntity(sara, "employee_contract", k.id), false);

  const sweep = await runHrExpirySweep(today);
  assert.ok(sweep.contracts >= 1, "contract ending in 10 days raises an alert");
  const { data: alerted } = await c.from("employee_contracts").select("expiry_alerted_at").eq("id", k.id).single();
  assert.ok(alerted!.expiry_alerted_at);

  const renewal = await renewContract(hr, k.id, "renewal", { start_date: end, end_date: null, title: null, basic_salary: "22000", currency: "EGP", terms: null, notes: null });
  assert.equal(renewal.version, 2);
  await contractAction(hr, renewal.id, "sign_employee", null);
  await contractAction(hr, renewal.id, "sign_company", null);
  await c.from("files").insert({ storage_path: `employee_contract/${renewal.id}/test.pdf`, name: "renewal.pdf", entity_type: "employee_contract", entity_id: renewal.id, is_finalized: true, uploaded_by: hr.userId });
  await contractAction(hr, renewal.id, "activate", null);
  const { data: v1 } = await c.from("employee_contracts").select("status").eq("id", k.id).single();
  assert.equal(v1!.status, "superseded", "history kept: v1 superseded by the renewal");

  // Offboarding → Terminated only after the checklist is complete.
  await changeLifecycleStatus(hr, emp.id, "offboarding", "resigned", { separation_type: "resignation", notice_date: today, last_working_day: end });
  const { data: sep } = await c.from("employee_separations").select("status").eq("employee_id", emp.id).single();
  assert.equal(sep!.status, "in_progress");
  const lists = await listEmployeeChecklists(emp.id);
  const off = lists.find((l) => l.template_key === "employee_offboarding")!;
  assert.ok(off.items.some((i) => i.auto_key === "final_salary") && off.items.some((i) => i.auto_key === "exit_interview"));
  await assert.rejects(changeLifecycleStatus(hr, emp.id, "terminated", "done"), ValidationError);
});

test("employee expense: manager → finance → reimbursement; other HR request; reports & overview", async () => {
  const hr = await bosUserFor("hr@taysonsta.local");
  const sara = await bosUserFor("sara@taysonsta.local");
  const finance = await bosUserFor("finance@taysonsta.local");
  const c = db();
  const { data: cat } = await c.from("expense_categories").select("id").eq("is_active", true).limit(1).single();
  const claim = await submitExpenseClaim(sara, { employee_id: sara.employee.id, category_id: cat!.id, description: uniq("Taxi"), amount: "350", currency: "EGP", expense_date: "2031-01-10", expense_kind: "transportation", project_id: null, client_id: null });
  cleanup.push(async () => { await c.from("approvals").delete().eq("entity_id", claim.id); await c.from("expenses").delete().eq("id", claim.id); });
  const { count: steps } = await c.from("approvals").select("id", { count: "exact", head: true }).eq("entity_id", claim.id);
  assert.equal(steps, 1, "step 1 (manager) first");
  await decideAll("expense", claim.id);
  const { data: e } = await c.from("expenses").select("approval_status, reimbursement_status").eq("id", claim.id).single();
  assert.equal(e!.approval_status, "approved");
  assert.equal(e!.reimbursement_status, "pending");
  const { count: total } = await c.from("approvals").select("id", { count: "exact", head: true }).eq("entity_id", claim.id);
  assert.equal(total, 2, "manager and finance steps");
  await reimburseDirectly(finance, claim.id, "CASH-1");
  const { data: r } = await c.from("expenses").select("reimbursement_status").eq("id", claim.id).single();
  assert.equal(r!.reimbursement_status, "reimbursed");

  const { data: type } = await c.from("hr_request_types").select("id").eq("key", "salary_certificate").single();
  const req = await submitHrRequest(sara, { employee_id: sara.employee.id, type_id: type!.id, subject: "Bank", details: null, due_date: null });
  cleanup.push(async () => { await c.from("approvals").delete().eq("entity_id", req.id); await c.from("hr_requests").delete().eq("id", req.id); });
  const { data: ap } = await c.from("approvals").select("id").eq("entity_id", req.id).eq("status", "pending").single();
  await decideApproval(ap!.id, "approved", null, { bos: hr });
  await progressHrRequest(hr, req.id, "completed", "Issued");
  const { data: done } = await c.from("hr_requests").select("status").eq("id", req.id).single();
  assert.equal(done!.status, "completed");

  const headcount = await runHrReport(hr, "headcount", { from: "2026-01-01", to: "2026-12-31" });
  assert.ok(headcount && headcount.rows.length > 0);
  assert.equal(await runHrReport(sara, "payroll_summary", { from: "2026-01-01", to: "2026-12-31" }), null, "payroll reports need payroll access");
  const overview = await getHrOverview(hr, { userIds: null, employeeIds: null, canPayroll: true, canDocuments: true, canRecruitment: true }, nowIso().slice(0, 10));
  assert.ok(overview.today.employees > 0);
  const t = overview.today;
  assert.ok(t.present + t.absent + t.onLeave + t.dayOff + t.notSignedIn <= t.employees, "every employee counted once at most");
  assert.ok(t.late <= t.present, "late employees are present");
});
