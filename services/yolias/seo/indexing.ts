import "server-only";
import { ydb } from "@/lib/yolias/db";

// Crawl check for Admin → SEO → Indexing (D-257): reads the live sitemap,
// opens every page and every internal link found on them, and records which
// answer with an error, a redirect or a noindex. Runs on demand (one button),
// at most 400 URLs, five at a time; the result is kept in seo_sync_runs.

export interface CrawlResult {
  checkedAt: string;
  sitemap: number;
  pages: { path: string; status: number; noindex: boolean; canonical: string | null }[];
  broken: { from: string; to: string; status: number }[];
  redirects: { from: string; to: string; status: number }[];
}

const tag = (html: string, re: RegExp) => re.exec(html)?.[1]?.trim() ?? null;

export async function crawlSite(by: string | null): Promise<CrawlResult> {
  const base = (process.env.YOLIAS_SITE_URL ?? "").replace(/\/$/, "");
  if (!base) throw new Error("YOLIAS_SITE_URL is not set.");
  const { data: run } = await ydb().from("seo_sync_runs").insert({ source: "crawl", started_by: by }).select("id").single();
  try {
    const sm = await fetch(`${base}/sitemap.xml`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const xml = sm.ok ? await sm.text() : "";
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => u.startsWith(base)).slice(0, 300);
    const pages: CrawlResult["pages"] = [];
    const links = new Map<string, string>(); // internal link → first page that has it
    const pool = async <T>(items: T[], fn: (x: T) => Promise<void>) => {
      let i = 0;
      await Promise.all(Array.from({ length: 5 }, async () => { while (i < items.length) await fn(items[i++]); }));
    };
    await pool(urls, async (u) => {
      const path = new URL(u).pathname;
      try {
        const res = await fetch(u, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { "user-agent": "YoliasAdminCrawl/1" } });
        const html = res.status === 200 ? await res.text() : "";
        pages.push({ path, status: res.status, noindex: /<meta[^>]+name="robots"[^>]+noindex/i.test(html), canonical: tag(html, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i) });
        for (const m of html.matchAll(/<a[^>]+href="(\/[^"#?]*)/g)) if (!m[1].startsWith("//") && !links.has(m[1])) links.set(m[1], path);
      } catch {
        pages.push({ path, status: 0, noindex: false, canonical: null });
      }
    });
    const known = new Set(pages.map((p) => p.path));
    const broken: CrawlResult["broken"] = [];
    const redirects: CrawlResult["redirects"] = [];
    const toCheck = [...links].filter(([to]) => !known.has(to) && !/^\/(api|_next|auth|admin)(\/|$)/.test(to)).slice(0, 100);
    await pool(toCheck, async ([to, from]) => {
      try {
        const res = await fetch(`${base}${to}`, { method: "GET", cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { "user-agent": "YoliasAdminCrawl/1" } });
        await res.body?.cancel();
        if (res.status >= 400 || res.status === 0) broken.push({ from, to, status: res.status });
        else if (res.status >= 300) redirects.push({ from, to, status: res.status });
      } catch {
        broken.push({ from, to, status: 0 });
      }
    });
    const result: CrawlResult = { checkedAt: new Date().toISOString(), sitemap: urls.length, pages: pages.sort((a, b) => a.path.localeCompare(b.path)), broken, redirects };
    if (run) await ydb().from("seo_sync_runs").update({ finished_at: new Date().toISOString(), ok: true, rows: pages.length + toCheck.length, result: result as never }).eq("id", run.id);
    return result;
  } catch (e) {
    if (run) await ydb().from("seo_sync_runs").update({ finished_at: new Date().toISOString(), ok: false, error: e instanceof Error ? e.message.slice(0, 500) : "failed" }).eq("id", run.id);
    throw e;
  }
}

export async function lastCrawl(): Promise<CrawlResult | null> {
  const { data } = await ydb().from("seo_sync_runs").select("result").eq("source", "crawl").eq("ok", true).order("started_at", { ascending: false }).limit(1).maybeSingle();
  return (data?.result as unknown as CrawlResult) ?? null;
}

export async function inspections() {
  const { data } = await ydb().from("seo_url_inspections").select("*").order("checked_at", { ascending: false }).limit(300);
  return data ?? [];
}

/** True once the SEO migration (20261123000000) is on the connected Yolias database. */
let ready: { at: number; ok: boolean } | null = null;
export async function seoReady(): Promise<boolean> {
  if (ready && Date.now() - ready.at < 60_000) return ready.ok;
  const { error } = await ydb().from("seo_keywords").select("id", { head: true, count: "exact" }).limit(1);
  ready = { at: Date.now(), ok: !error };
  return !error;
}
