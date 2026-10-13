import { redirect } from "next/navigation";

// Automations are off for now (owner, 2026-10-13, D-205); kept in the database for later.
export default function AutomationsPage() {
  redirect("/ai/agents");
}
