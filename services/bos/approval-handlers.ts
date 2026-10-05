import "server-only";

// Importing this module registers every module's approval outcome handler
// with the generic approval engine (services/bos/approvals.ts). Each module
// service calls onApprovalDecided(type, handler) at module load.
import "@/services/bos/handlers/leave-approvals";
import "@/services/bos/handlers/attendance-approvals";
import "@/services/bos/handlers/finance-approvals";
import "@/services/bos/handlers/design-approvals";
import "@/services/bos/handlers/sales-approvals";
import "@/services/bos/handlers/hr-approvals";
