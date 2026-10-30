import { redirect } from "next/navigation";

// Old customer links (emails, notifications) open the conversation (D-268).
export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(/^[0-9a-f-]{36}$/i.test(id) ? `/inbox?lead=${id}` : "/inbox");
}
