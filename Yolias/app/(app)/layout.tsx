import { cookies, headers } from "next/headers";
import { AppShell } from "@/components/app/AppShell";
import { SIDEBAR_COOKIE, type ShellData } from "@/components/app/types";
import { requireSession } from "@/lib/session";
import { initials } from "@/lib/format";
import { plans } from "@/lib/plans";
import { recentStrategies } from "@/services/strategies";
import { monthlyUsage, teamMembers } from "@/services/workspace";

function deviceLabel(ua: string): string {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return `${browser} on ${os}`;
}

function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  const v4 = ip.split(",")[0].trim().split(".");
  return v4.length === 4 ? `${v4[0]}.${v4[1]}.•••.••` : null;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const { profile, workspace } = session;
  const plan = plans[workspace.plan];
  const h = await headers();

  const [recent, usage, team] = await Promise.all([
    recentStrategies(workspace.id),
    monthlyUsage(workspace.id),
    teamMembers(workspace.id),
  ]);

  const name = profile.full_name || session.email;
  const data: ShellData = {
    user: {
      id: session.userId,
      name,
      email: session.email,
      emailConfirmed: session.emailConfirmed,
      avatarUrl: profile.avatar_url,
      initials: initials(profile.full_name, session.email.slice(0, 2).toUpperCase()),
    },
    preferences: {
      theme: profile.theme,
      text_size: profile.text_size,
      language: profile.language,
      timezone: profile.timezone,
      country: profile.country,
      notify_campaign_done: profile.notify_campaign_done,
    },
    workspace: {
      name: workspace.name ?? "",
      plan: workspace.plan,
      planLabel: plan.label,
      priceUsd: plan.priceUsd,
      prospectCredits: plan.prospectCredits,
      companyLookups: plan.companyLookups,
      seats: plan.seats,
    },
    role: session.role,
    usage,
    team: {
      members: team.members.map((m) => ({
        user_id: m.user_id,
        role: m.role,
        name: m.profile?.full_name || m.profile?.email || "Member",
        email: m.profile?.email ?? "",
        avatarUrl: m.profile?.avatar_url ?? null,
        initials: initials(m.profile?.full_name, (m.profile?.email ?? "?").slice(0, 2).toUpperCase()),
      })),
      invitations: team.invitations.map((i) => ({ id: i.id, email: i.email, role: i.role })),
    },
    recent,
    device: { label: deviceLabel(h.get("user-agent") ?? ""), ip: maskIp(h.get("x-forwarded-for") ?? h.get("x-real-ip")) },
  };

  const sidebarClosed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "closed";
  return <AppShell data={data} initialClosed={sidebarClosed}>{children}</AppShell>;
}
