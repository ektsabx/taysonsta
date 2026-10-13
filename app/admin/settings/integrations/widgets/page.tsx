import { redirect } from "next/navigation";

// The website widget is managed from Support now (owner, 2026-10-13, D-207),
// next to the support AI agent. Old links keep working.
export default function IntegrationWidgetsMoved() {
  redirect("/admin/support/widgets");
}
