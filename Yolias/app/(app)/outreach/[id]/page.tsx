import { notFound, redirect } from "next/navigation";

// A campaign has one place, Conversations (owner 2026-10-21): its
// conversations, emails and sequence are sub-tabs there. Old links land on its emails.
export default async function OutreachCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  redirect(`/conversations?campaign=${id}&view=emails`);
}
