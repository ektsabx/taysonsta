import { redirect } from "next/navigation";

// The CRM was removed (owner, 2026-10-30, D-268): Yolias is search, outreach,
// meetings and analytics. Old links land on Conversations.
export default function CrmPage() {
  redirect("/inbox");
}
