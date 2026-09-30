import "server-only";
import { nowIso } from "@/lib/bos/clock";
import { db } from "@/lib/bos/db";
import { audit, recordStatus } from "@/lib/bos/audit";
import { onApprovalDecided } from "@/services/bos/approvals";
import { applyRunDecision } from "@/services/bos/hr/payroll";
import { applyBonusDecision, applyHrRequestDecision, applyLoanDecision } from "@/services/bos/hr/requests";
import { afterCompensationApproved } from "@/services/bos/hr/people";
import { markOfferSent } from "@/services/bos/hr/recruitment";

// HR & Workforce approval outcomes (docs/bos/28 §14–25).
onApprovalDecided("payroll", (a, decision, actor, comment) => applyRunDecision(a.entity_id, decision, actor.userId, comment));
onApprovalDecided("bonus", (a, decision, actor, comment) => applyBonusDecision(a.entity_id, decision, actor.userId, comment));
onApprovalDecided("loan", (a, decision, actor, comment) => applyLoanDecision(a.entity_id, decision, actor.userId, comment));
onApprovalDecided("hr_request", (a, decision, actor, comment) => applyHrRequestDecision(a.entity_id, decision, actor.userId, comment));

onApprovalDecided("salary_adjustment", async (a, decision, actor, comment) => {
  const compensationId = (a.payload as { compensation_id?: string } | null)?.compensation_id;
  if (!compensationId) return;
  const { data: comp } = await db().from("employee_compensation").select("*").eq("id", compensationId).maybeSingle();
  if (!comp || comp.approval_status !== "pending") return;
  const { data: updated } = await db().from("employee_compensation").update({ approval_status: decision, decided_by: actor.userId, decided_at: nowIso() }).eq("id", compensationId).select("*").single();
  await recordStatus("employee_compensation", compensationId, "pending", decision, actor.userId, comment);
  await audit({ actorId: actor.userId, action: `compensation.${decision}`, entityType: "employee", entityId: comp.employee_id, newValue: { compensation_id: compensationId }, reason: comment });
  if (decision === "approved" && updated) await afterCompensationApproved(actor.userId, updated);
});

onApprovalDecided("job_offer", async (a, decision, actor, comment) => {
  if (decision === "approved") await markOfferSent(a.entity_id, actor.userId);
  else await audit({ actorId: actor.userId, action: "recruitment.offer_rejected_internally", entityType: "job_offer", entityId: a.entity_id, reason: comment });
});
