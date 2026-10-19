import { redirect } from "next/navigation";

// The Campaigns page and the Search results view were removed (owner, 2026-10-19):
// searches live in Yolias AI (Recent searches); their prospects in Prospects.
export default function CampaignsPage() {
  redirect("/prospects");
}
