import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { canManageTeam, requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { getLead } from "@/services/crm";
import { teamMembers } from "@/services/workspace";
import { fitCheck } from "@/lib/agents/research";
import { LeadDetailView } from "@/components/app/ws/LeadDetail";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ws.crm.title} — Yolias` };
}

// One lead (D-195): contact and company, fit with the customer profile,
// deal, campaigns, messages and replies, reminders, meetings, notes and the
// full history. Same lead the Inbox and Outreach show.
export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireViewer();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [detail, team] = await Promise.all([getLead(session.workspace.id, id), teamMembers(session.workspace.id)]);
  if (!detail) notFound();
  const profile = detail.profiles.find((p) => p.id === detail.lead.customer_profile_id) ?? detail.profiles.find((p) => p.is_default) ?? null;
  const fit = profile ? fitCheck(profile, {
    industry: detail.company?.industry ?? detail.company?.category ?? null,
    description: detail.company?.description ?? null,
    employees: detail.company?.employee_count ?? null,
    country: detail.person?.country ?? detail.company?.country ?? null,
    title: detail.person?.title ?? null,
  }) : null;
  return (
    <LeadDetailView
      detail={detail}
      fit={fit ? { ...fit, profileName: profile!.name } : null}
      members={team.members.map((m) => ({ id: m.user_id, name: m.profile?.full_name || m.profile?.email || "—" }))}
      canDelete={canManageTeam(session)}
      timeZone={session.profile.timezone}
    />
  );
}
