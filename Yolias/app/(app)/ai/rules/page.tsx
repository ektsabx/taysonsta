import { redirect } from "next/navigation";

// Rules & Permissions are part of the agent's settings now (D-205).
export default function RulesPage() {
  redirect("/ai/agents#rules");
}
