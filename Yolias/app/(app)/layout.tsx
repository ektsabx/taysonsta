import { cookies, headers } from "next/headers";
import { AppShell } from "@/components/app/AppShell";
import { SIDEBAR_COOKIE, type ShellData } from "@/components/app/types";
import { canManageTeam, requireSession } from "@/lib/session";
import { initials } from "@/lib/format";
import { getPlanCatalog, workspaceCurrency } from "@/lib/plan-catalog";
import { billingTestMode } from "@/lib/billing";
import { myMailboxes, providersAvailable } from "@/services/outreach";
import { unreadNotifications } from "@/services/workspace";
import { providerFor } from "@/lib/payments";
import { planPrice } from "@/lib/plans";
import { recentStrategies } from "@/services/strategies";
import { listInvoices, listPacks, monthlyUsage, teamMembers } from "@/services/workspace";

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
  const plan = (await getPlanCatalog())[workspace.plan];
  const h = await headers();

  const currency = await workspaceCurrency(workspace);
  const [recent, usage, team, invoices, packs, online, mailboxes, unread] = await Promise.all([
    recentStrategies(workspace.id),
    monthlyUsage(workspace.id),
    teamMembers(workspace.id),
    canManageTeam(session) ? listInvoices(workspace.id) : Promise.resolve([]),
    listPacks(),
    providerFor(currency).then(Boolean),
    myMailboxes(session.userId),
    unreadNotifications(session.userId),
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
      notify_usage: profile.notify_usage,
      notify_billing: profile.notify_billing,
      notify_product: profile.notify_product,
    },
    workspace: {
      name: workspace.name ?? "",
      website: workspace.website,
      offering: workspace.offering,
      industry: workspace.industry,
      idealCustomer: workspace.ideal_customer,
      targetMarkets: workspace.target_markets,
      plan: workspace.plan,
      price: planPrice(plan, workspace.billing_currency) ?? plan.priceUsd,
      currency: planPrice(plan, workspace.billing_currency) == null ? "USD" : workspace.billing_currency,
      // Plan quota + any grants this month (usage ledger).
      prospects: usage.allowance,
      subscriptionStatus: workspace.subscription_status,
      periodEnd: workspace.current_period_end,
      billingPeriod: workspace.billing_period,
      cancelAtPeriodEnd: workspace.cancel_at_period_end,
    },
    role: session.role,
    usage,
    invoices: invoices.map((i) => ({ id: i.id, number: i.number, date: i.created_at, amount: Number(i.amount), currency: i.currency, status: i.status, test: i.mode === "test" })),
    packs: packs.map((p) => ({ id: p.id, prospects: p.prospects, price: Number(p.price_usd) })),
    billing: { online, testMode: billingTestMode() },
    mailboxes: mailboxes.map((m) => ({ provider: m.provider, email: m.email, status: m.status })),
    mailProviders: await providersAvailable(),
    unread,
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
