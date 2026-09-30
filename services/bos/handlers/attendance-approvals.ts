import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { db } from "@/lib/bos/db";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { onApprovalDecided } from "@/services/bos/approvals";
import { getSetting } from "@/lib/bos/settings";

// Attendance corrections (§36): approval applies the change inside SQL
// (bos_apply_attendance_correction), which writes the audit row with
// who/when/what/old/new/reason.
onApprovalDecided("attendance_correction", async (approval, decision, actor, comment) => {
  const client = db();
  const { data: correction } = await client.from("attendance_corrections").select("*").eq("id", approval.entity_id).maybeSingle();
  if (!correction || correction.status !== "pending") return;

  if (decision === "approved") {
    const { error } = await client.rpc("bos_apply_attendance_correction", {
      p_correction: correction.id,
      p_reviewer: actor.userId as string,
      p_comment: (comment ?? null) as string,
    });
    if (error) throw error;
    return;
  }

  await client
    .from("attendance_corrections")
    .update({ status: "rejected", reviewed_by: actor.userId, reviewed_at: nowIso(), review_comment: comment })
    .eq("id", correction.id);
  await recordStatus("attendance_correction", correction.id, "pending", "rejected", actor.userId, comment);
  await audit({
    actorId: actor.userId,
    action: "attendance.correction_rejected",
    entityType: "attendance_correction",
    entityId: correction.id,
    oldValue: correction.original,
    newValue: { requested_clock_in: correction.requested_clock_in, requested_clock_out: correction.requested_clock_out },
    reason: comment,
  });
  const { data: emp } = await client.from("employees").select("id").eq("user_id", correction.user_id).maybeSingle();
  await emitEvent({
    type: "attendance.correction_rejected",
    entityType: "employee",
    entityId: emp?.id ?? correction.user_id,
    summary: `Attendance correction rejected for ${correction.work_date}`,
    payload: { correction_id: correction.id, employee_user_id: correction.user_id, comment },
    actorId: actor.userId,
  });
});

onApprovalDecided("overtime", async (approval, decision, actor, comment) => {
  const client = db();
  const { data: ot } = await client.from("overtime_requests").select("*").eq("id", approval.entity_id).maybeSingle();
  if (!ot || ot.status !== "pending") return;
  // Approved minutes default to the requested minutes; the rate multiplier
  // follows the overtime rules for the day type (Settings → HR → payroll).
  const policy = await getSetting("payroll_policy");
  const multiplier = ot.day_type === "holiday" ? policy.overtime.holiday_multiplier : ot.day_type === "day_off" ? policy.overtime.day_off_multiplier : policy.overtime.workday_multiplier;
  await client
    .from("overtime_requests")
    .update({
      status: decision,
      approved_by: actor.userId,
      approved_at: nowIso(),
      compensation_status: decision === "approved" ? "pending" : "not_applicable",
      approved_minutes: decision === "approved" ? ot.approved_minutes ?? ot.minutes : null,
      rate_multiplier: decision === "approved" ? multiplier : null,
    })
    .eq("id", ot.id);
  await recordStatus("overtime_request", ot.id, "pending", decision, actor.userId, comment);
  await audit({ actorId: actor.userId, action: `overtime.${decision}`, entityType: "overtime_request", entityId: ot.id, newValue: { status: decision, minutes: ot.minutes }, reason: comment });
  const { data: emp } = await client.from("employees").select("id").eq("user_id", ot.user_id).maybeSingle();
  await emitEvent({
    type: "overtime.decided",
    entityType: "employee",
    entityId: emp?.id ?? ot.user_id,
    summary: `Overtime ${decision} (${ot.work_date}, ${Math.round(ot.minutes / 6) / 10}h)`,
    payload: { overtime_id: ot.id, employee_user_id: ot.user_id, decision },
    actorId: actor.userId,
  });
});
