import { redirect } from "next/navigation";

// Conversations split again (D-256, after AgentSDR): campaigns live in
// /outreach (the list and each campaign's page), conversations in /inbox.
// Old links keep working.
export default async function ConversationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const campaign = /^[0-9a-f-]{36}$/i.test(one(sp.campaign)) ? one(sp.campaign) : null;
  const lead = /^[0-9a-f-]{36}$/i.test(one(sp.lead)) ? one(sp.lead) : null;
  if (campaign && !lead) {
    const view = one(sp.view);
    redirect(`/outreach/${campaign}${view === "emails" ? "?tab=leads" : view === "sequence" ? "?tab=sequence" : ""}`);
  }
  if (one(sp.tab) === "campaigns") redirect("/outreach");
  const p = new URLSearchParams();
  if (lead) p.set("lead", lead);
  if (campaign) p.set("campaign", campaign);
  if (one(sp.q)) p.set("q", one(sp.q).slice(0, 100));
  redirect(`/inbox${p.size ? `?${p}` : ""}`);
}
