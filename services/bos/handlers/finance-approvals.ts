import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { db } from "@/lib/bos/db";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { onApprovalDecided } from "@/services/bos/approvals";

onApprovalDecided("expense", async (approval, decision, actor, comment) => {
  const client = db();
  const { data: expense } = await client.from("expenses").select("*").eq("id", approval.entity_id).maybeSingle();
  if (!expense || expense.approval_status !== "pending") return;
  await client
    .from("expenses")
    .update({
      approval_status: decision,
      approved_by: actor.userId,
      approved_at: nowIso(),
      // Approved employee claims wait for reimbursement (payroll or direct).
      ...(expense.reimbursable ? { reimbursement_status: decision === "approved" ? ("pending" as const) : ("not_applicable" as const) } : {}),
    })
    .eq("id", expense.id);
  await recordStatus("expense", expense.id, "pending", decision, actor.userId, comment);
  await audit({ actorId: actor.userId, action: `expense.${decision}`, entityType: "expense", entityId: expense.id, newValue: { approval_status: decision, amount: expense.amount, currency: expense.currency }, reason: comment });
  await emitEvent({
    type: `expense.${decision}`,
    entityType: "expense",
    entityId: expense.id,
    summary: `Expense ${decision}: ${expense.description} (${expense.amount} ${expense.currency})`,
    payload: { creator_user_id: expense.created_by },
    actorId: actor.userId,
  });
  if (expense.employee_user_id && expense.reimbursable) {
    await emitEvent({
      type: "employee_expense.decided",
      entityType: "employee_expense",
      entityId: expense.id,
      summary: `Expense claim ${decision}: ${expense.description} (${expense.amount} ${expense.currency})`,
      payload: { employee_user_id: expense.employee_user_id, decision, comment },
      actorId: actor.userId,
    });
    if (decision === "approved") {
      await emitEvent({ type: "employee_expense.approved", entityType: "employee_expense", entityId: expense.id, summary: `Expense claim approved — reimbursement pending: ${expense.description}`, payload: { employee_user_id: expense.employee_user_id }, actorId: actor.userId });
    }
  }
});

// Invoice approval (when enabled): approved drafts become sendable.
onApprovalDecided("invoice", async (approval, decision, actor, comment) => {
  await audit({ actorId: actor.userId, action: `invoice.approval_${decision}`, entityType: "invoice", entityId: approval.entity_id, reason: comment });
});
