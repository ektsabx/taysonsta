import "server-only";
import { ydb } from "@/lib/yolias/db";
import { paymentStats, repeatRate, type PaymentRow } from "@/lib/yolias/payment-math";
import { DAY, change } from "@/lib/yolias/growth-math";

// Latest payments (owner, 2026-11-05): everything about Yolias's payments for a
// period against the one before, with each payment and who made it. Live mode
// only: test payments are never counted.

const COLS = "workspace_id, kind, plan, amount, status, provider, created_at, paid_at, failure_reason";

async function all(since: string | null, until: string | null): Promise<PaymentRow[]> {
  const out: PaymentRow[] = [];
  for (let from = 0; from < 50_000; from += 1000) {
    let q = ydb().from("payments").select(COLS).eq("mode", "live").order("created_at").range(from, from + 999);
    if (since) q = q.gte("created_at", since);
    if (until) q = q.lt("created_at", until);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...((data ?? []) as unknown as PaymentRow[]));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

export async function paymentsDashboard(since: string, until: string) {
  const a = Date.parse(since), b = Date.parse(until);
  const everything = await all(null, until);
  const inRange = (r: PaymentRow, x: number, y: number) => { const t = Date.parse(r.created_at); return t >= x && t < y; };
  const now = everything.filter((r) => inRange(r, a, b));
  const prev = everything.filter((r) => inRange(r, a - (b - a), a));
  const paidBefore = (t: number) => new Set(everything.filter((r) => r.status === "succeeded" && Date.parse(r.created_at) < t).map((r) => r.workspace_id));
  const stats = paymentStats(now, paidBefore(a));
  const before = paymentStats(prev, paidBefore(a - (b - a)));

  const group = (key: (r: PaymentRow) => string) => {
    const m = new Map<string, { key: string; revenue: number; paid: number }>();
    for (const r of now.filter((x) => x.status === "succeeded")) {
      const k = key(r); const g = m.get(k) ?? { key: k, revenue: 0, paid: 0 };
      g.revenue += Number(r.amount); g.paid++; m.set(k, g);
    }
    return [...m.values()].sort((x, y) => y.revenue - x.revenue);
  };
  const days: string[] = []; for (let t = a; t < b; t += DAY) days.push(new Date(t).toISOString().slice(0, 10));
  const daily = days.map((d) => now.filter((r) => r.status === "succeeded" && r.created_at.startsWith(d)).reduce((x, r) => x + Number(r.amount), 0));
  const failures = new Map<string, number>();
  for (const r of now.filter((x) => x.status === "failed")) { const k = r.failure_reason ?? "-"; failures.set(k, (failures.get(k) ?? 0) + 1); }

  const { data: latest, error } = await ydb().from("payments").select("id, workspace_id, kind, plan, billing_period, prospects, amount, charge_amount, charge_currency, status, provider, failure_reason, created_at, paid_at, workspace:workspaces(name, billing_country, created_by)")
    .eq("mode", "live").gte("created_at", since).lt("created_at", until).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  const owners = [...new Set((latest ?? []).map((p) => (p.workspace as unknown as { created_by: string | null } | null)?.created_by).filter(Boolean))] as string[];
  const { data: people } = owners.length ? await ydb().from("profiles").select("id, email").in("id", owners) : { data: [] };
  const email = new Map((people ?? []).map((p) => [p.id, p.email]));

  return {
    stats, before, change: (k: "revenue" | "paid" | "customers" | "failed") => change(stats[k], before[k]),
    repeat: repeatRate(everything), days, daily, byKind: group((r) => r.kind), byPlan: group((r) => r.plan ?? "payg"), byProvider: group((r) => r.provider ?? "-"),
    failures: [...failures.entries()].map(([key, n]) => ({ key, n })).sort((x, y) => y.n - x.n),
    latest: (latest ?? []).map((p) => {
      const w = p.workspace as unknown as { name: string | null; billing_country: string | null; created_by: string | null } | null;
      return { ...p, customer: w?.name ?? "", country: w?.billing_country ?? null, email: w?.created_by ? email.get(w.created_by) ?? null : null };
    }),
  };
}
