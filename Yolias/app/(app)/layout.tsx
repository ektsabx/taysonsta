import { cookies, headers } from "next/headers";
import { AppShell } from "@/components/app/AppShell";
import { AI_SECTION_COOKIE, SIDEBAR_COOKIE, type ShellData } from "@/components/app/types";
import { loadWelcomeVideo } from "@/lib/welcome-video-server";
import { canManageTeam, requireSession } from "@/lib/session";
import { initials } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { shouldAskForReview } from "@/lib/review-prompt";
import { getPlanCatalog } from "@/lib/plan-catalog";
import { billingTestMode } from "@/lib/billing";
import { unreadNotifications } from "@/services/workspace";
import { billingRoute, paymentsConnected } from "@/lib/payments";
import { loadPolar, polarPortalUrl } from "@/lib/payments/polar";
import { planPrice } from "@/lib/plans";
import { recentStrategies } from "@/services/strategies";
import { listInvoices, listPacks, monthlyUsage, teamMembers } from "@/services/workspace";
import type { Metadata as NoindexMetadata } from "next";
import { noindex } from "@/lib/seo";

// Never in search results (D-179): private, per-user pages.
export const metadata: NoindexMetadata = { robots: noindex };

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

// Conversations with a reply nobody opened yet (RLS: the member's workspace).
async function unreadThreads(workspaceId: string): Promise<number> {
  const { count } = await (await createClient()).from("crm_leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("unread", true);
  return count ?? 0;
}

// The user's own phone (RLS: only its owner can read it).
async function ownPhone(userId: string): Promise<string | null> {
  const { data } = await (await createClient()).from("user_phones").select("phone").eq("user_id", userId).maybeSingle();
  return data?.phone ?? null;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const { profile, workspace } = session;
  const plan = (await getPlanCatalog())[workspace.plan];
  const h = await headers();

  const [route, polar] = await Promise.all([billingRoute(workspace), loadPolar()]);
  const polarEnv = polar?.environment ?? "production";
  const [recent, usage, team, invoices, packs, online, unread, phone, askReview, welcomeVideo, inboxUnread] = await Promise.all([
    recentStrategies(workspace.id),
    monthlyUsage(workspace.id),
    teamMembers(workspace.id),
    canManageTeam(session) ? listInvoices(workspace.id) : Promise.resolve([]),
    listPacks(),
    paymentsConnected(workspace),
    unreadNotifications(session.userId),
    ownPhone(session.userId),
    shouldAskForReview(session).catch(() => false),
    loadWelcomeVideo(),
    unreadThreads(session.workspace.id),
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
      phone,
      askReview,
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
    packs: packs.map((p) => ({ id: p.id, prospects: p.prospects, emails: p.emails, price: Number(p.price_usd) })),
    billing: { online, testMode: billingTestMode(), provider: route, portalUrl: route === "polar" && workspace.polar_subscription_id ? polarPortalUrl(polarEnv) : null },
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
    welcome: { video: welcomeVideo, show: Boolean(welcomeVideo) && !profile.welcome_video_seen_at },
    inboxUnread,
  };

  const jar = await cookies();
  const sidebarClosed = jar.get(SIDEBAR_COOKIE)?.value === "closed";
  const aiSectionOpen = jar.get(AI_SECTION_COOKIE)?.value !== "closed";
  return <AppShell data={data} initialClosed={sidebarClosed} initialAiOpen={aiSectionOpen}>{children}</AppShell>;
}
