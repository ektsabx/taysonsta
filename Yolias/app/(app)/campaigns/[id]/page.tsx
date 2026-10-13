import { redirect } from "next/navigation";

// Campaigns live inside Prospects now (owner, 2026-10-13, D-204): a search's
// campaign is the Prospects table filtered to it, with its summary on top.
export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(/^[0-9a-f-]{36}$/i.test(id) ? `/prospects?campaign=${id}` : "/prospects?view=searches");
}
