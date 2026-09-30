import { redirect } from "next/navigation";

// Proposals moved under Sales (§5 sidebar). Kept for existing links.
export default function LegacyProposalsPage() {
  redirect("/admin/sales/proposals");
}
