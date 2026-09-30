import "server-only";
import { db } from "@/lib/bos/db";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { onApprovalDecided } from "@/services/bos/approvals";

// Proposal internal review (Draft → Internal Review → Sent). A rejection
// sends the proposal back to draft with the reviewer's comment.
onApprovalDecided("proposal", async (approval, decision, actor, comment) => {
  const client = db();
  const { data: proposal } = await client.from("proposals").select("id, status, title, owner_id, deal_id, client_id").eq("id", approval.entity_id).maybeSingle();
  if (!proposal) return;
  if (decision === "rejected" && proposal.status === "ready") {
    await client.from("proposals").update({ status: "draft" }).eq("id", proposal.id);
    await recordStatus("proposal", proposal.id, "ready", "draft", actor.userId, comment);
  }
  await audit({ actorId: actor.userId, action: `proposal.review_${decision}`, entityType: "proposal", entityId: proposal.id, reason: comment });
  await emitEvent({
    type: `proposal.review_${decision}`,
    entityType: "proposal",
    entityId: proposal.id,
    summary: `Internal review ${decision}: ${proposal.title}`,
    payload: { owner_user_id: proposal.owner_id, deal_id: proposal.deal_id, comment },
    links: [{ type: "deal", id: proposal.deal_id }, { type: "client", id: proposal.client_id }],
    actorId: actor.userId,
  });
});

onApprovalDecided("contract", async (approval, decision, actor, comment) => {
  await audit({ actorId: actor.userId, action: `contract.approval_${decision}`, entityType: "contract", entityId: approval.entity_id, reason: comment });
});
