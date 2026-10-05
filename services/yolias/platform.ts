import "server-only";
import { ydb, type YTables } from "@/lib/yolias/db";
import { isYoliasPlan, monthStartUtc, type YoliasPlan } from "@/lib/yolias/plans";
import { getPlanTerms } from "@/services/yolias/usage";

// Read models for the Yolias Platform pages of Yolias Admin
// (docs/09-yolias-admin.md §B). Real data only: every number here is a
// count or sum over the Yolias database. Callers check `platform.read` first.

const PAGE = 50;

type Workspace = YTables<"workspaces">;

export type WorkspaceStats = { members: number; searches: number; campaigns: number; prospects_total: number; prospects_month: number; allowance: number; last_activity_at: string | null };

/** Paid plan that is actually billed (live). Test-mode subscriptions are not revenue. */
function isLivePaid(w: Pick<Workspace, "plan" | "subscription_status">) {
  return w.plan !== "free" && w.subscription_status === "active";
}
function isTestPaid(w: Pick<Workspace, "plan" | "subscription_status">) {
  return w.plan !== "free" && w.subscription_status === "test";
}

async function count(table: "profiles" | "workspaces" | "strategies" | "campaigns" | "prospects", since?: Date): Promise<number> {
  let q = ydb().from(table).select("*", { count: "exact", head: true });
  if (since) q = q.gte("created_at", since.toISOString());
  const { count: n, error } = await q;
  if (error) throw error;
  return n ?? 0;
}

export async function platformOverview() {
  const monthStart = monthStartUtc();
  const days30 = new Date(Date.now() - 30 * 86_400_000);
  const [users, users30, workspaces, searches, searches30, prospects, prospectsMonth, wsRows, campRows, recent] = await Promise.all([
    count("profiles"),
    count("profiles", days30),
    count("workspaces"),
    count("strategies"),
    count("strategies", days30),
    count("prospects"),
    count("prospects", monthStart),
    ydb().from("workspaces").select("plan, subscription_status, billing_period"),
    ydb().from("campaigns").select("status"),
    ydb().from("profiles").select("id, email, full_name, created_at, workspace_id").order("created_at", { ascending: false }).limit(8),
  ]);
  const [terms, { data: m30 }] = await Promise.all([getPlanTerms(), ydb().rpc("admin_platform_metrics", { p_since: days30.toISOString() })]);

  const plans = { free: 0, pro: 0, growth: 0 } as Record<YoliasPlan, number>;
  let livePaid = 0;
  let testPaid = 0;
  let mrrLive = 0;
  let mrrTest = 0;
  for (const w of wsRows.data ?? []) {
    plans[w.plan as YoliasPlan] = (plans[w.plan as YoliasPlan] ?? 0) + 1;
    const price = terms[w.plan as YoliasPlan]?.priceUsd ?? 0;
    if (isLivePaid(w)) {
      livePaid++;
      mrrLive += price;
    } else if (isTestPaid(w)) {
      testPaid++;
      mrrTest += price;
    }
  }
  const campaigns: Record<string, number> = {};
  for (const c of campRows.data ?? []) campaigns[c.status] = (campaigns[c.status] ?? 0) + 1;

  return {
    users, users30, workspaces, searches, searches30, prospects, prospectsMonth,
    plans, terms, livePaid, testPaid, mrrLive, mrrTest,
    last30: (m30 ?? {}) as Record<string, number | null>,
    campaigns, campaignsTotal: (campRows.data ?? []).length,
    recentUsers: recent.data ?? [],
  };
}

export async function workspaceStats(): Promise<Map<string, WorkspaceStats>> {
  const { data, error } = await ydb().rpc("admin_workspace_stats", { month_start: monthStartUtc().toISOString() });
  if (error) throw error;
  return new Map((data ?? []).map(({ workspace_id, ...s }) => [workspace_id, s]));
}

/** Auth details (last sign-in, confirmed) that live in auth.users, not profiles. */
async function authUsers(): Promise<Map<string, { last_sign_in_at: string | null; confirmed: boolean; suspended: boolean }>> {
  const out = new Map<string, { last_sign_in_at: string | null; confirmed: boolean; suspended: boolean }>();
  for (let page = 1; page < 50; page++) {
    const { data, error } = await ydb().auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    for (const u of data.users) {
      const banned = (u as { banned_until?: string | null }).banned_until;
      out.set(u.id, { last_sign_in_at: u.last_sign_in_at ?? null, confirmed: Boolean(u.email_confirmed_at), suspended: Boolean(banned && new Date(banned) > new Date()) });
    }
    if (data.users.length < 1000) break;
  }
  return out;
}

export async function listUsers(opts: { q?: string; page: number }) {
  let q = ydb().from("profiles").select("id, email, full_name, workspace_id, language, country, onboarded_at, created_at", { count: "exact" });
  if (opts.q) {
    const term = opts.q.replace(/[%_,()]/g, " ").trim();
    if (term) q = q.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
  }
  const { data, count: total, error } = await q.order("created_at", { ascending: false }).range((opts.page - 1) * PAGE, opts.page * PAGE - 1);
  if (error) throw error;
  const rows = data ?? [];
  const wsIds = [...new Set(rows.map((r) => r.workspace_id).filter(Boolean))] as string[];
  const [{ data: ws }, { data: roles }, auth] = await Promise.all([
    wsIds.length ? ydb().from("workspaces").select("id, name, plan, subscription_status").in("id", wsIds) : Promise.resolve({ data: [] as Pick<Workspace, "id" | "name" | "plan" | "subscription_status">[] }),
    rows.length ? ydb().from("workspace_members").select("workspace_id, user_id, role").in("user_id", rows.map((r) => r.id)) : Promise.resolve({ data: [] as YTables<"workspace_members">[] }),
    authUsers(),
  ]);
  const wsById = new Map((ws ?? []).map((w) => [w.id, w]));
  return {
    total: total ?? 0,
    pages: Math.max(1, Math.ceil((total ?? 0) / PAGE)),
    rows: rows.map((r) => ({
      ...r,
      workspace: r.workspace_id ? wsById.get(r.workspace_id) ?? null : null,
      role: (roles ?? []).find((m) => m.user_id === r.id && m.workspace_id === r.workspace_id)?.role ?? null,
      ...(auth.get(r.id) ?? { last_sign_in_at: null, confirmed: false, suspended: false }),
    })),
  };
}

export async function listWorkspaces(opts: { q?: string; plan?: string; page: number }) {
  let q = ydb().from("workspaces").select("*", { count: "exact" });
  if (opts.q) {
    const term = opts.q.replace(/[%_,()]/g, " ").trim();
    if (term) q = q.or(`name.ilike.%${term}%,website.ilike.%${term}%`);
  }
  if (isYoliasPlan(opts.plan)) q = q.eq("plan", opts.plan);
  const [{ data, count: total, error }, stats] = await Promise.all([
    q.order("created_at", { ascending: false }).range((opts.page - 1) * PAGE, opts.page * PAGE - 1),
    workspaceStats(),
  ]);
  if (error) throw error;
  return {
    total: total ?? 0,
    pages: Math.max(1, Math.ceil((total ?? 0) / PAGE)),
    rows: (data ?? []).map((w) => ({ ...w, stats: stats.get(w.id) ?? null })),
  };
}

export async function getWorkspace(id: string) {
  const { data: ws } = await ydb().from("workspaces").select("*").eq("id", id).maybeSingle();
  if (!ws) return null;
  const [members, strategies, campaigns, invoices, events, stats, invitations] = await Promise.all([
    ydb().from("workspace_members").select("user_id, role, created_at").eq("workspace_id", id).order("created_at"),
    ydb().from("strategies").select("id, title, status, created_at").eq("workspace_id", id).order("created_at", { ascending: false }).limit(20),
    ydb().from("campaigns").select("id, name, status, quota, companies_found, prospects_found, created_at").eq("workspace_id", id).order("created_at", { ascending: false }).limit(20),
    ydb().from("invoices").select("id, number, plan, billing_period, amount_usd, status, mode, created_at").eq("workspace_id", id).order("created_at", { ascending: false }).limit(20),
    ydb().from("subscription_events").select("id, plan, status, amount_usd, mode, billing_period, created_at").eq("workspace_id", id).order("created_at", { ascending: false }).limit(20),
    workspaceStats(),
    ydb().from("workspace_invitations").select("id, email, role, created_at").eq("workspace_id", id).is("accepted_at", null),
  ]);
  const ids = (members.data ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length ? await ydb().from("profiles").select("id, email, full_name").in("id", ids) : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return {
    workspace: ws,
    stats: stats.get(id) ?? null,
    members: (members.data ?? []).map((m) => ({ ...m, profile: byId.get(m.user_id) ?? null })),
    invitations: invitations.data ?? [],
    strategies: strategies.data ?? [],
    campaigns: campaigns.data ?? [],
    invoices: invoices.data ?? [],
    events: events.data ?? [],
  };
}

export async function listSearches(opts: { q?: string; status?: string; page: number }) {
  let q = ydb().from("strategies").select("id, workspace_id, title, prompt, status, error, created_at", { count: "exact" });
  if (opts.q) {
    const term = opts.q.replace(/[%_,()]/g, " ").trim();
    if (term) q = q.or(`title.ilike.%${term}%,prompt.ilike.%${term}%`);
  }
  if (opts.status && ["understanding", "ready", "failed"].includes(opts.status)) q = q.eq("status", opts.status as YTables<"strategies">["status"]);
  const { data, count: total, error } = await q.order("created_at", { ascending: false }).range((opts.page - 1) * PAGE, opts.page * PAGE - 1);
  if (error) throw error;
  const rows = data ?? [];
  const wsIds = [...new Set(rows.map((r) => r.workspace_id))];
  const [{ data: ws }, { data: camps }] = await Promise.all([
    wsIds.length ? ydb().from("workspaces").select("id, name, plan").in("id", wsIds) : Promise.resolve({ data: [] as Pick<Workspace, "id" | "name" | "plan">[] }),
    rows.length ? ydb().from("campaigns").select("strategy_id, status, prospects_found, quota").in("strategy_id", rows.map((r) => r.id)) : Promise.resolve({ data: [] as Pick<YTables<"campaigns">, "strategy_id" | "status" | "prospects_found" | "quota">[] }),
  ]);
  const wsById = new Map((ws ?? []).map((w) => [w.id, w]));
  return {
    total: total ?? 0,
    pages: Math.max(1, Math.ceil((total ?? 0) / PAGE)),
    rows: rows.map((r) => ({ ...r, workspace: wsById.get(r.workspace_id) ?? null, campaign: (camps ?? []).find((c) => c.strategy_id === r.id) ?? null })),
  };
}
