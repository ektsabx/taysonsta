import { redirect } from "next/navigation";

// Customer Profiles is a tab of Company Knowledge (owner brief 2026-10-19).
export default function ProfilesPage() {
  redirect("/ai/knowledge?tab=profiles");
}
