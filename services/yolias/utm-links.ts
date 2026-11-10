import "server-only";
import { ydb } from "@/lib/yolias/db";

// Links and their results (owner, 2026-11-10): every ?utm_source=… link the
// owner shares, with the visitors it brought, the accounts created, checkouts
// opened, customers who paid and the revenue. First touch: a person counts for
// the link they first arrived from. Live payments only.

type Row = { key: string; source: string; medium: string; campaign: string; visitors: number; signups: number; checkouts: number; paid: number; revenue: number };

async function all<T>(q: (a: number, b: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let a = 0; a < 200_000; a += 1000) {
    const { data, error } = await q(a, a + 999);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export async function utmLinks(since: string, until: string): Promise<Row[]> {
  const db = ydb();
  const [visits, signups] = await Promise.all([
    all<{ visitor: string; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null }>((a, b) => db.from("site_visits").select("visitor, utm_source, utm_medium, utm_campaign").not("utm_source", "is", null).gte("created_at", since).lt("created_at", until).range(a, b)),
    all<{ user_id: string; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null }>((a, b) => db.from("signup_attribution").select("user_id, utm_source, utm_medium, utm_campaign").not("utm_source", "is", null).gte("created_at", since).lt("created_at", until).range(a, b)),
  ]);
  const keyOf = (r: { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null }) => [r.utm_source ?? "", r.utm_medium ?? "", r.utm_campaign ?? ""].join("|");
  const rows = new Map<string, Row & { _v: Set<string> }>();
  const get = (k: string) => {
    let r = rows.get(k);
    if (!r) { const [source, medium, campaign] = k.split("|"); r = { key: k, source, medium, campaign, visitors: 0, signups: 0, checkouts: 0, paid: 0, revenue: 0, _v: new Set() }; rows.set(k, r); }
    return r;
  };
  for (const v of visits) get(keyOf(v))._v.add(v.visitor);
  const linkOfUser = new Map(signups.map((s) => [s.user_id, keyOf(s)]));
  for (const s of signups) get(keyOf(s)).signups++;
  const users = [...linkOfUser.keys()];
  if (users.length) {
    const chunks = Array.from({ length: Math.ceil(users.length / 500) }, (_, i) => users.slice(i * 500, i * 500 + 500));
    for (const part of chunks) {
      const [{ data: co }, { data: ws }] = await Promise.all([
        db.from("checkout_sessions").select("user_id").in("user_id", part).gte("created_at", since).lt("created_at", until),
        db.from("workspaces").select("id, created_by").in("created_by", part as string[]),
      ]);
      const opened = new Set((co ?? []).map((c) => c.user_id).filter((u): u is string => Boolean(u)));
      for (const u of opened) get(linkOfUser.get(u)!).checkouts++;
      const owner = new Map((ws ?? []).filter((w) => w.created_by).map((w) => [w.id, w.created_by as string]));
      const ids = [...owner.keys()];
      if (!ids.length) continue;
      const { data: pays } = await db.from("payments").select("workspace_id, amount").eq("mode", "live").eq("status", "succeeded").in("workspace_id", ids).gte("created_at", since).lt("created_at", until);
      const payers = new Set<string>();
      for (const p of pays ?? []) {
        const k = linkOfUser.get(owner.get(p.workspace_id)!); if (!k) continue;
        get(k).revenue += Number(p.amount); payers.add(`${k}#${p.workspace_id}`);
      }
      for (const x of payers) get(x.split("#")[0]).paid++;
    }
  }
  return [...rows.values()].map(({ _v, ...r }) => ({ ...r, visitors: _v.size })).sort((a, b) => b.visitors + b.signups * 10 - (a.visitors + a.signups * 10));
}
