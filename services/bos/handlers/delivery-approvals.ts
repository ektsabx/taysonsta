import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { db } from "@/lib/bos/db";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { onApprovalDecided, type ApprovalOutcomeHandler } from "@/services/bos/approvals";

// Milestone / design / deliverable approvals update the milestone.
const milestoneHandler: ApprovalOutcomeHandler = async (approval, decision, actor, comment) => {
  if (approval.entity_type !== "milestone") return;
  const client = db();
  const { data: milestone } = await client.from("milestones").select("*").eq("id", approval.entity_id).maybeSingle();
  if (!milestone) return;
  await client.from("milestones").update({ approval_status: decision }).eq("id", milestone.id);
  await emitEvent({
    type: decision === "approved" ? "milestone.approved" : "milestone.rejected",
    entityType: "project",
    entityId: milestone.project_id,
    summary: `${milestone.name}: ${decision === "approved" ? "approved" : "changes requested"}${actor.contactId ? " by client" : ""}`,
    payload: { milestone_id: milestone.id, comment, project_id: milestone.project_id },
    actorId: actor.userId,
    actorType: actor.contactId ? "client" : "user",
    visibility: "client",
  });
};

onApprovalDecided("milestone", milestoneHandler);
onApprovalDecided("design", async (approval, decision, actor, comment) => {
  if (approval.entity_type === "milestone") return milestoneHandler(approval, decision, actor, comment);
  await audit({ actorId: actor.userId, actorType: actor.contactId ? "client" : "user", action: `design.${decision}`, entityType: approval.entity_type, entityId: approval.entity_id, reason: comment });
});

onApprovalDecided("final_delivery", async (approval, decision, actor, comment) => {
  await emitEvent({
    type: decision === "approved" ? "project.final_approved" : "project.final_rejected",
    entityType: "project",
    entityId: approval.entity_id,
    summary: decision === "approved" ? "Client approved final delivery" : "Client requested changes to the final delivery",
    payload: { comment, project_id: approval.entity_id },
    actorId: actor.userId,
    actorType: actor.contactId ? "client" : "user",
    visibility: "client",
  });
});

onApprovalDecided("scope", async (approval, decision, actor, comment) => {
  await audit({ actorId: actor.userId, actorType: actor.contactId ? "client" : "user", action: `scope.${decision}`, entityType: approval.entity_type, entityId: approval.entity_id, reason: comment });
});

// Change request: client approval → Approved → Added to Project (budget,
// timeline, scope updated atomically in bos_apply_change_request) (§25).
onApprovalDecided("change_request", async (approval, decision, actor, comment) => {
  const client = db();
  const { data: cr } = await client.from("change_requests").select("*").eq("id", approval.entity_id).maybeSingle();
  if (!cr || !["client_approval", "proposal", "assessment", "requested"].includes(cr.status)) return;

  if (decision === "rejected") {
    await client.from("change_requests").update({ status: "rejected", decided_at: nowIso() }).eq("id", cr.id);
    await recordStatus("change_request", cr.id, cr.status, "rejected", actor.userId, comment);
    await emitEvent({
      type: "change_request.rejected",
      entityType: "change_request",
      entityId: cr.id,
      summary: `${cr.cr_number} rejected`,
      payload: { project_id: cr.project_id, comment },
      links: [{ type: "project", id: cr.project_id }, { type: "client", id: cr.client_id }],
      actorId: actor.userId,
      actorType: actor.contactId ? "client" : "user",
      visibility: "client",
    });
    return;
  }

  await client.from("change_requests").update({ status: "approved", decided_at: nowIso() }).eq("id", cr.id);
  await recordStatus("change_request", cr.id, cr.status, "approved", actor.userId, comment);
  await emitEvent({
    type: "change_request.approved",
    entityType: "change_request",
    entityId: cr.id,
    summary: `${cr.cr_number} approved`,
    payload: { project_id: cr.project_id },
    links: [{ type: "project", id: cr.project_id }, { type: "client", id: cr.client_id }],
    actorId: actor.userId,
    actorType: actor.contactId ? "client" : "user",
    visibility: "client",
  });
  const { error } = await client.rpc("bos_apply_change_request", { p_cr: cr.id, p_actor: actor.userId as string });
  if (error) throw error;
});
