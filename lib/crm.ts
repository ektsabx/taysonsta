import type { CrmStage } from "@/types/database";

export const crmStages: CrmStage[] = [
  "lead",
  "qualified",
  "call_booked",
  "call_completed",
  "proposal_requested",
  "proposal_sent",
  "proposal_viewed",
  "proposal_accepted",
  "proposal_rejected",
  "contract",
  "invoice",
];

export const crmStageLabels: Record<CrmStage, string> = {
  lead: "عميل محتمل",
  qualified: "مؤهل",
  call_booked: "تم حجز مكالمة",
  call_completed: "انتهت المكالمة",
  proposal_requested: "طلب مقترح",
  proposal_sent: "تم إرسال المقترح",
  proposal_viewed: "تمت مشاهدة المقترح",
  proposal_accepted: "تم قبول المقترح",
  proposal_rejected: "تم رفض المقترح",
  contract: "عقد",
  invoice: "فاتورة",
};
