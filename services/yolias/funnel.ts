import "server-only";
import { ydb } from "@/lib/yolias/db";

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, cap = 20_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// The journey funnel (owner, 2026-10-29): of the people who signed up in the
// last 30 days, how many reached each step, from real rows only. Each step
// counts people who ever reached it, whatever the order (in Yolias the plan
// comes right after onboarding, so steps 2–4 usually follow payment).
//   1. signed up, and whether their business looks like services / an agency
//      (a keyword reading of the industry they typed at onboarding);
//   2. started a real search (not a chat);  3. a search delivered results;
//   4. used the data: saved, exported or put prospects in a campaign;
//   5. saw the price: the pricing page or the checkout;
//   6. started paying (left for the payment provider);  7. paid.
export interface FunnelStep { id: string; label: string; n: number }
export interface Funnel {
  cohort: number;
  audience: { services: number; other: number; unknown: number; top: { industry: string; n: number }[] };
  steps: FunnelStep[];
}

const SERVICES = /agenc|وكال|market|تسويق|consult|استشار|servic|خدم|software|برمج|saas|develop|تطوير|design|تصميم|digital|ديجيتال|رقمي|advertis|إعلان|اعلان|media|ميديا|outsourc|b2b|training|تدريب|recruit|توظيف|accounting|محاسب|legal|محام|قانون|\bit\b|تقني|seo|branding|هوية|production|إنتاج|انتاج|creative|إبداع|events|فعاليات|lead gen/i;

async function inChunks<T>(ids: string[], q: (chunk: string[], a: number, b: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    out.push(...(await all<T>((a, b) => q(chunk, a, b))));
  }
  return out;
}

export async function yoliasFunnel(): Promise<Funnel> {
  const db = ydb();
  const d30 = iso(Date.now() - 30 * DAY);
  const profiles = await all<{ id: string; workspace_id: string | null }>((a, b) => db.from("profiles").select("id, workspace_id").gte("created_at", d30).range(a, b));
  const users = profiles.map((p) => p.id);
  const wsIds = [...new Set(profiles.map((p) => p.workspace_id).filter((w): w is string => Boolean(w)))];
  const names = ["plans_viewed", "checkout_opened", "payment_started", "gateway_redirected", "payment_succeeded"];

  const [events, searches, found, workspaces, savedCo, savedPe, exports, campaigns, paid] = await Promise.all([
    inChunks<{ name: string; user_id: string | null }>(users, (c, a, b) => db.from("funnel_events").select("name, user_id").in("name", names).in("user_id", c).range(a, b)),
    // A real search, not a chat with Yolias AI; results = a search run that delivered companies or people.
    inChunks<{ created_by: string | null }>(users, (c, a, b) => db.from("strategies").select("created_by").in("created_by", c).neq("status", "chat").range(a, b)),
    inChunks<{ created_by: string | null }>(users, (c, a, b) => db.from("campaigns").select("created_by").in("created_by", c).or("prospects_found.gt.0,companies_found.gt.0").range(a, b)),
    inChunks<{ id: string; industry: string | null }>(wsIds, (c, a, b) => db.from("workspaces").select("id, industry").in("id", c).range(a, b)),
    inChunks<{ workspace_id: string }>(wsIds, (c, a, b) => db.from("companies").select("workspace_id").in("workspace_id", c).not("bookmarked_at", "is", null).range(a, b)),
    inChunks<{ workspace_id: string }>(wsIds, (c, a, b) => db.from("prospects").select("workspace_id").in("workspace_id", c).not("bookmarked_at", "is", null).range(a, b)),
    inChunks<{ workspace_id: string }>(wsIds, (c, a, b) => db.from("workspace_activity").select("workspace_id").in("workspace_id", c).eq("kind", "export").range(a, b)),
    inChunks<{ workspace_id: string }>(wsIds, (c, a, b) => db.from("outreach_campaigns").select("workspace_id").in("workspace_id", c).range(a, b)),
    inChunks<{ workspace_id: string }>(wsIds, (c, a, b) => db.from("payments").select("workspace_id").in("workspace_id", c).eq("status", "succeeded").eq("mode", "live").range(a, b)),
  ]);

  const reached = (n: string[]) => new Set(events.filter((e) => e.user_id && n.includes(e.name)).map((e) => e.user_id as string));
  const usedWs = new Set([...savedCo, ...savedPe, ...exports, ...campaigns].map((r) => r.workspace_id));
  const paidWs = new Set(paid.map((r) => r.workspace_id));
  const paidUsers = reached(["payment_succeeded"]);
  const byWs = (s: Set<string>) => profiles.filter((p) => p.workspace_id && s.has(p.workspace_id)).length;

  const industry = new Map(workspaces.map((w) => [w.id, (w.industry ?? "").trim()]));
  let services = 0, other = 0, unknown = 0;
  const top = new Map<string, number>();
  for (const p of profiles) {
    const ind = p.workspace_id ? industry.get(p.workspace_id) ?? "" : "";
    if (!ind) { unknown++; continue; }
    if (SERVICES.test(ind)) services++; else other++;
    const key = ind.toLowerCase().slice(0, 40);
    top.set(key, (top.get(key) ?? 0) + 1);
  }

  return {
    cohort: profiles.length,
    audience: { services, other, unknown, top: [...top.entries()].map(([i, n]) => ({ industry: i, n })).sort((a, b) => b.n - a.n).slice(0, 5) },
    steps: [
      { id: "signup", label: "سجّلوا", n: profiles.length },
      { id: "search", label: "بدأوا بحثًا حقيقيًا", n: new Set(searches.map((r) => r.created_by).filter(Boolean)).size },
      { id: "results", label: "وصلوا لنتائج", n: new Set(found.map((r) => r.created_by).filter(Boolean)).size },
      { id: "used", label: "استخدموا البيانات (حفظ أو تصدير أو حملة)", n: byWs(usedWs) },
      { id: "price", label: "شافوا السعر", n: reached(["plans_viewed", "checkout_opened"]).size },
      { id: "pay_start", label: "ضغطوا لبدء الدفع", n: reached(["payment_started", "gateway_redirected"]).size },
      { id: "paid", label: "أكملوا الاشتراك", n: profiles.filter((p) => paidUsers.has(p.id) || (p.workspace_id && paidWs.has(p.workspace_id))).length },
    ],
  };
}
