import "server-only";
import { audit } from "@/lib/bos/audit";
import { onApprovalDecided } from "@/services/bos/approvals";

// Design and scope sign-offs are recorded in the audit log.
onApprovalDecided("design", async (approval, decision, actor, comment) => {
  await audit({ actorId: actor.userId, actorType: actor.contactId ? "client" : "user", action: `design.${decision}`, entityType: approval.entity_type, entityId: approval.entity_id, reason: comment });
});

onApprovalDecided("scope", async (approval, decision, actor, comment) => {
  await audit({ actorId: actor.userId, actorType: actor.contactId ? "client" : "user", action: `scope.${decision}`, entityType: approval.entity_type, entityId: approval.entity_id, reason: comment });
});
