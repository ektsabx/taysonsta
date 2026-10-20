import { redirect } from "next/navigation";

// Outreach campaigns are the "Campaigns" tab of /conversations now (D-249).
export default function OutreachPage() {
  redirect("/conversations?tab=campaigns");
}
