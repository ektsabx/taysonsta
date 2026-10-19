import { redirect } from "next/navigation";

// The AI Agent settings page left the member's app (owner brief 2026-10-19,
// D-233): Yolias AI works on its own from Company Knowledge, the conversation
// and the connected tools. The engine, its tools, policies and the workspace
// rules (workspace_ai_settings, with safe defaults) are unchanged; Yolias
// Admin manages them. Pending approvals moved to the Inbox.
export default function AgentsPage() {
  redirect("/ai/knowledge");
}
