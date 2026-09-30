import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { db } from "@/lib/bos/db";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { onApprovalDecided } from "@/services/bos/approvals";

// Access request (IT §8): after the final approval step the grant moves to
// "pending" (to be provisioned in the external tool) and the app admin is
// notified; a rejection closes the request.
onApprovalDecided("access_request", async (approval, decision, actor, comment) => {
  const client = db();
  const { data: request } = await client.from("access_requests").select("*").eq("id", approval.entity_id).maybeSingle();
  if (!request || request.status !== "pending") return;

  await client.from("access_requests").update({ status: decision, decided_at: nowIso() }).eq("id", request.id);
  await recordStatus("access_request", request.id, "pending", decision, actor.userId, comment);

  const { data: app } = await client.from("external_apps").select("name, admin_user_id, password_vault").eq("id", request.app_id).maybeSingle();
  const { data: emp } = await client.from("employees").select("id, user_id, full_name").eq("id", request.employee_id).maybeSingle();

  if (decision === "approved") {
    const { data: existing } = await client.from("access_grants").select("id, status, access_level").eq("employee_id", request.employee_id).eq("app_id", request.app_id).maybeSingle();
    if (existing) {
      await client.from("access_grants").update({ status: "pending", access_level: request.access_level, request_id: request.id, source: "request" }).eq("id", existing.id);
    } else {
      await client.from("access_grants").insert({
        employee_id: request.employee_id,
        app_id: request.app_id,
        access_level: request.access_level,
        status: "pending",
        source: "request",
        request_id: request.id,
        vault: app?.password_vault ?? null,
      });
    }
  } else {
    await client.from("access_grants").update({ status: "rejected" }).eq("employee_id", request.employee_id).eq("app_id", request.app_id).in("status", ["requested", "not_started"]);
  }

  await audit({
    actorId: actor.userId,
    action: `access.request_${decision}`,
    entityType: "employee",
    entityId: request.employee_id,
    newValue: { app: app?.name, access_level: request.access_level, status: decision },
    reason: comment,
    metadata: { request_id: request.id },
  });

  await emitEvent({
    type: decision === "approved" ? "access.request_approved" : "access.request_rejected",
    entityType: "employee",
    entityId: request.employee_id,
    summary: `Access to ${app?.name ?? "application"} ${decision}${decision === "approved" ? " — waiting for provisioning" : ""}`,
    payload: { request_id: request.id, employee_user_id: emp?.user_id, creator_user_id: request.requested_by, assignee_user_id: app?.admin_user_id ?? null },
    actorId: actor.userId,
  });
});
