import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { db } from "@/lib/bos/db";
import { recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { onApprovalDecided } from "@/services/bos/approvals";

// Leave: Request → Manager Review → Approved / Rejected (§39).
onApprovalDecided("leave", async (approval, decision, actor, comment) => {
  const client = db();
  const { data: leave } = await client.from("leave_requests").select("*").eq("id", approval.entity_id).maybeSingle();
  if (!leave || leave.status !== "pending") return;

  await client
    .from("leave_requests")
    .update({ status: decision, approver_id: actor.userId, decided_at: nowIso(), decision_comment: comment })
    .eq("id", leave.id);
  await recordStatus("leave_request", leave.id, "pending", decision, actor.userId, comment);

  if (decision === "approved") {
    await client.rpc("bos_apply_leave", { p_leave: leave.id });
  }

  const { data: emp } = await client.from("employees").select("id, full_name").eq("user_id", leave.user_id).maybeSingle();
  await emitEvent({
    type: decision === "approved" ? "leave.approved" : "leave.rejected",
    entityType: "employee",
    entityId: emp?.id ?? leave.user_id,
    summary: `Leave ${decision} (${leave.start_date} → ${leave.end_date})`,
    payload: { leave_id: leave.id, employee_user_id: leave.user_id, comment },
    actorId: actor.userId,
  });
});
