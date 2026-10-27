import "server-only";
import { cache } from "react";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Locale } from "@/lib/i18n/config";
import { seoKinds, toCompetitor, toSeoPage, type Competitor, type SeoKind, type SeoPage } from "./seo-pages";

// SEO pages as the site shows them (D-257): published rows, and scheduled
// rows whose time has come. Drafts appear only in a signed Admin preview.

const columns = "id, kind, slug, meta, doc, seo, status, scheduled_at, updated_at, published_at, sort";

const live = cache(async (): Promise<SeoPage[]> => {
  const now = new Date().toISOString();
  const { data, error } = await createAdminClient().from("content_entries").select(columns)
    .in("kind", [...seoKinds])
    .or(`status.eq.published,and(status.eq.scheduled,scheduled_at.lte.${now})`)
    .order("sort").order("updated_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map(toSeoPage).filter((p): p is SeoPage => p !== null);
});

export async function seoPages(kind?: SeoKind): Promise<SeoPage[]> {
  const all = await live();
  return kind ? all.filter((p) => p.kind === kind) : all;
}

export async function seoPage(kind: SeoKind, slug: string): Promise<SeoPage | null> {
  return (await live()).find((p) => p.kind === kind && p.slug === slug) ?? null;
}

/** Indexable pages (sitemap, llms.txt): no noindex, no canonical pointing elsewhere. */
export async function indexableSeoPages(): Promise<SeoPage[]> {
  return (await live()).filter((p) => !p.noindex && !p.canonical);
}

const competitorRows = cache(async () => {
  const { data, error } = await createAdminClient().from("seo_competitors").select("slug, name, website, pricing_url, summary, best_for, strengths, limits, pricing, publishes_prices, last_reviewed_at");
  return error ? [] : data ?? [];
});

export async function competitors(locale: Locale): Promise<Map<string, Competitor>> {
  return new Map((await competitorRows()).map((r) => [r.slug, toCompetitor(r, locale)]));
}

// ───────────────────────── Preview (Yolias Admin) ─────────────────────────
// Admin signs `seo-preview:<id>:<expiry>` with the service role key both apps
// already hold, so a draft can be seen on the real site for 30 minutes
// without a new secret and without making it public.

function previewSig(id: string, exp: number): string {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").update(`seo-preview:${id}:${exp}`).digest("hex");
}

export function checkPreview(id: string, exp: string | undefined, sig: string | undefined): boolean {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !exp || !sig || !/^\d{10}$/.test(exp) || !/^[0-9a-f]{64}$/.test(sig)) return false;
  const e = Number(exp);
  if (e < Date.now() / 1000 || e > Date.now() / 1000 + 3600) return false;
  const a = Buffer.from(previewSig(id, e));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function previewPage(id: string): Promise<SeoPage | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await createAdminClient().from("content_entries").select(columns).eq("id", id).maybeSingle();
  return data ? toSeoPage(data) : null;
}
