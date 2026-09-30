import type { ProposalStatus } from "@/types/database";

// Pure (client-safe) badge helper for proposal statuses. Spec labels (§15):
// ready = Internal Review, published = Sent.
export function getStatusBadgeInfo(status: ProposalStatus): { label: string; className: string } {
  const map: Record<ProposalStatus, { label: string; className: string }> = {
    draft: { label: "مسودة", className: "draft" },
    ready: { label: "مراجعة داخلية", className: "pending" },
    published: { label: "مُرسل", className: "published" },
    viewed: { label: "تمت المشاهدة", className: "confirmed" },
    accepted: { label: "مقبول", className: "confirmed" },
    rejected: { label: "مرفوض", className: "cancelled" },
    expired: { label: "منتهي", className: "unqualified" },
  };
  return map[status];
}
