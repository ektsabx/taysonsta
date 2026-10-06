import "server-only";
import { ydb } from "@/lib/yolias/db";
import { monthStartUtc } from "@/lib/yolias/plans";

// Yolias Admin modules (final spec phase 9): risk, SEO, prospect
// intelligence (data quality) and usage. Real data only (rule 39): every
// figure comes from the Yolias database or a live check of the website.

const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

async function names(ids: string[]): Promise<Map<string, string | null>> {
  if (!ids.length) return new Map();
  const { data } = await ydb().from("workspaces").select("id, name").in("id", [...new Set(ids)]);
  return new Map((data ?? []).map((w) => [w.id, w.name]));
}

function tally<T>(rows: T[], key: (r: T) => string | null): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

// ───────────────────────── Risk ─────────────────────────

export async function riskOverview(days = 30) {
  const from = since(days);
  const [pastDue, failedPayments, refunds, denied, outreachFailed, campaignsFailed, jobFailures, suspicious] = await Promise.all([
    ydb().from("workspaces").select("id, name, plan, current_period_end, billing_currency").eq("subscription_status", "past_due"),
    ydb().from("payments").select("workspace_id, failure_reason").eq("status", "failed").gte("created_at", from),
    ydb().from("payments").select("workspace_id").eq("status", "refunded").gte("updated_at", from),
    ydb().from("agent_tool_calls").select("workspace_id, outcome").in("outcome", ["denied", "invalid"]).gte("created_at", from).limit(5000),
    ydb().from("outreach_messages").select("workspace_id, error").eq("status", "failed").gte("updated_at", from),
    ydb().from("campaigns").select("workspace_id").eq("status", "failed").gte("updated_at", from),
    ydb().from("job_failures").select("id", { count: "exact", head: true }).is("retried_at", null),
    ydb().from("email_log").select("user_id").eq("kind", "suspicious_sign_in").gte("created_at", from),
  ]);
  const signals = new Map<string, { workspaceId: string; failedPayments: number; refunds: number; denied: number; outreachFailed: number; suppressedSends: number; campaignsFailed: number }>();
  const bump = (ws: string | null, k: "failedPayments" | "refunds" | "denied" | "outreachFailed" | "suppressedSends" | "campaignsFailed") => {
    if (!ws) return;
    const s = signals.get(ws) ?? { workspaceId: ws, failedPayments: 0, refunds: 0, denied: 0, outreachFailed: 0, suppressedSends: 0, campaignsFailed: 0 };
    s[k]++;
    signals.set(ws, s);
  };
  for (const p of failedPayments.data ?? []) bump(p.workspace_id, "failedPayments");
  for (const p of refunds.data ?? []) bump(p.workspace_id, "refunds");
  for (const d of denied.data ?? []) bump(d.workspace_id, "denied");
  for (const o of outreachFailed.data ?? []) bump(o.workspace_id, o.error === "suppressed" ? "suppressedSends" : "outreachFailed");
  for (const c of campaignsFailed.data ?? []) bump(c.workspace_id, "campaignsFailed");
  const rows = [...signals.values()].map((s) => ({ ...s, score: s.failedPayments * 3 + s.refunds * 2 + s.denied + s.outreachFailed + s.suppressedSends * 2 + s.campaignsFailed }))
    .sort((a, b) => b.score - a.score).slice(0, 50);
  const n = await names(rows.map((r) => r.workspaceId));
  return {
    days,
    pastDue: pastDue.data ?? [],
    unresolvedJobs: jobFailures.count ?? 0,
    suspiciousSignIns: (suspicious.data ?? []).length,
    suspiciousUsers: tally(suspicious.data ?? [], (r) => r.user_id).size,
    workspaces: rows.map((r) => ({ ...r, name: n.get(r.workspaceId) ?? null })),
  };
}

// ───────────────────────── Prospect intelligence (data quality) ─────────────────────────

export async function dataQuality() {
  const db = ydb();
  const head = { count: "exact" as const, head: true };
  const ttlCutoff = since(45);
  const [people, withEmail, verified, invalid, withPhone, withLinkedin, stale, companies, local, staleCompanies, sample] = await Promise.all([
    db.from("prospects").select("id", head),
    db.from("prospects").select("id", head).not("email", "is", null),
    db.from("prospects").select("id", head).eq("email_status", "verified"),
    db.from("prospects").select("id", head).eq("email_status", "invalid"),
    db.from("prospects").select("id", head).not("phone", "is", null),
    db.from("prospects").select("id", head).not("linkedin_url", "is", null),
    db.from("prospects").select("id", head).lt("last_updated", ttlCutoff),
    db.from("companies").select("id", head).eq("kind", "company"),
    db.from("companies").select("id", head).eq("kind", "local_business"),
    db.from("companies").select("id", head).lt("last_updated", since(90)),
    db.from("prospects").select("missing_fields, confidence, source, match_score").order("created_at", { ascending: false }).limit(5000),
  ]);
  const rows = sample.data ?? [];
  const missing = new Map<string, number>();
  const bySource = new Map<string, { n: number; match: number; matchN: number; conf: number; confN: number }>();
  for (const r of rows) {
    for (const f of r.missing_fields ?? []) missing.set(f, (missing.get(f) ?? 0) + 1);
    const s = bySource.get(r.source) ?? { n: 0, match: 0, matchN: 0, conf: 0, confN: 0 };
    s.n++;
    if (r.match_score != null) { s.match += r.match_score; s.matchN++; }
    if (r.confidence != null) { s.conf += Number(r.confidence); s.confN++; }
    bySource.set(r.source, s);
  }
  const total = people.count ?? 0;
  return {
    people: total,
    companies: companies.count ?? 0,
    localBusinesses: local.count ?? 0,
    rates: {
      email: total ? (withEmail.count ?? 0) / total : null,
      verified: total ? (verified.count ?? 0) / total : null,
      invalid: total ? (invalid.count ?? 0) / total : null,
      phone: total ? (withPhone.count ?? 0) / total : null,
      linkedin: total ? (withLinkedin.count ?? 0) / total : null,
    },
    stalePeople: stale.count ?? 0,
    staleCompanies: staleCompanies.count ?? 0,
    sampleSize: rows.length,
    missing: [...missing.entries()].sort((a, b) => b[1] - a[1]).map(([field, count]) => ({ field, count })),
    bySource: [...bySource.entries()].map(([source, s]) => ({ source, people: s.n, avgMatch: s.matchN ? Math.round(s.match / s.matchN) : null, avgConfidence: s.confN ? s.conf / s.confN : null })).sort((a, b) => b.people - a.people),
  };
}

// ───────────────────────── Usage ─────────────────────────

export async function usageOverview() {
  const period = monthStartUtc().toISOString().slice(0, 10);
  const [{ data: ledger }, { data: workspaces }, { data: quotas }, { data: packs }] = await Promise.all([
    ydb().from("usage_ledger").select("workspace_id, kind, prospects").eq("period_start", period).limit(100_000),
    ydb().from("workspaces").select("id, name, plan, subscription_status"),
    ydb().from("plan_quotas").select("plan, prospects_per_month"),
    ydb().from("payments").select("prospects, amount, currency, mode").eq("kind", "prospect_pack").eq("status", "succeeded").gte("paid_at", `${period}T00:00:00Z`),
  ]);
  const quota = new Map((quotas ?? []).map((q) => [q.plan, q.prospects_per_month]));
  const per = new Map<string, { consumed: number; granted: number }>();
  for (const l of ledger ?? []) {
    const p = per.get(l.workspace_id) ?? { consumed: 0, granted: 0 };
    if (l.kind === "consume") p.consumed += l.prospects;
    if (l.kind === "grant" || l.kind === "adjust") p.granted += l.prospects;
    per.set(l.workspace_id, p);
  }
  const rows = (workspaces ?? []).filter((w) => w.subscription_status !== "none").map((w) => {
    const u = per.get(w.id) ?? { consumed: 0, granted: 0 };
    const allowance = (quota.get(w.plan) ?? 0) + u.granted;
    return { id: w.id, name: w.name, plan: w.plan, consumed: u.consumed, allowance, pct: allowance ? u.consumed / allowance : 0 };
  });
  const byPlan = new Map<string, { plan: string; workspaces: number; consumed: number; allowance: number; atLimit: number }>();
  for (const r of rows) {
    const p = byPlan.get(r.plan) ?? { plan: r.plan, workspaces: 0, consumed: 0, allowance: 0, atLimit: 0 };
    p.workspaces++;
    p.consumed += r.consumed;
    p.allowance += r.allowance;
    if (r.allowance && r.consumed >= r.allowance) p.atLimit++;
    byPlan.set(r.plan, p);
  }
  const packTotals = { prospects: 0, live: { USD: 0, EGP: 0 } as Record<string, number>, test: 0 };
  for (const p of packs ?? []) {
    packTotals.prospects += p.prospects ?? 0;
    if (p.mode === "live") packTotals.live[p.currency] = (packTotals.live[p.currency] ?? 0) + Number(p.amount);
    else packTotals.test++;
  }
  return {
    period,
    consumed: rows.reduce((s, r) => s + r.consumed, 0),
    allowance: rows.reduce((s, r) => s + r.allowance, 0),
    byPlan: [...byPlan.values()],
    top: rows.sort((a, b) => b.consumed - a.consumed).slice(0, 20),
    packs: packTotals,
  };
}

// ───────────────────────── SEO (live check of the website) ─────────────────────────

const seoPages = ["/", "/product", "/pricing", "/about", "/contact", "/help-center", "/blog", "/docs/introduction", "/legal/privacy"];

function tag(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}

export async function seoAudit() {
  const base = (process.env.YOLIAS_SITE_URL ?? "").replace(/\/$/, "");
  if (!base) return { base: null, pages: [], robots: null, sitemapUrls: null };
  const get = async (path: string, locale: "en" | "ar") => {
    try {
      const res = await fetch(`${base}${path}`, { headers: { cookie: `yolias_locale=${locale}` }, cache: "no-store", signal: AbortSignal.timeout(15_000), redirect: "follow" });
      return { status: res.status, html: await res.text() };
    } catch {
      return { status: 0, html: "" };
    }
  };
  const pages = [];
  for (const path of seoPages) {
    for (const locale of ["en", "ar"] as const) {
      const { status, html } = await get(path, locale);
      const title = tag(html, /<title[^>]*>([^<]*)<\/title>/i);
      const description = tag(html, /<meta[^>]+name="description"[^>]+content="([^"]*)"/i);
      const h1 = (html.match(/<h1[\s>]/gi) ?? []).length;
      const lang = tag(html, /<html[^>]+lang="([^"]+)"/i);
      const issues: string[] = [];
      if (status !== 200) issues.push(`HTTP ${status}`);
      if (!title) issues.push("no_title");
      else if (title.length > 65) issues.push("long_title");
      if (!description) issues.push("no_description");
      else if (description.length > 170) issues.push("long_description");
      if (h1 !== 1) issues.push(h1 === 0 ? "no_h1" : "many_h1");
      if (lang !== locale) issues.push("wrong_lang");
      pages.push({ path, locale, status, title, description, h1, lang, issues });
    }
  }
  // The same description on several pages of one language tells search engines nothing.
  for (const locale of ["en", "ar"]) {
    const seen = new Map<string, number>();
    for (const p of pages) if (p.locale === locale && p.description) seen.set(p.description, (seen.get(p.description) ?? 0) + 1);
    for (const p of pages) if (p.locale === locale && p.description && (seen.get(p.description) ?? 0) > 1) p.issues.push("duplicate_description");
  }
  const robots = await get("/robots.txt", "en");
  const sitemap = await get("/sitemap.xml", "en");
  return {
    base,
    pages,
    robots: robots.status === 200 ? { sitemap: /sitemap:/i.test(robots.html), disallowsApp: /Disallow: \/prospects/i.test(robots.html) } : null,
    sitemapUrls: sitemap.status === 200 ? (sitemap.html.match(/<url>/g) ?? []).length : null,
  };
}
