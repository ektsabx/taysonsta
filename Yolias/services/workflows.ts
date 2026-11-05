import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { workflows, type Workflow, type WorkflowText } from "@/lib/content/workflows";
import type { Localized } from "@/lib/content/types";

// Use cases (owner, 2026-11-05): written in code, edited and added in Yolias
// Admin (content_entries, kind use_case). What Admin saved wins.
type Meta = { category?: Workflow["category"]; template?: string | null; related?: string[]; help?: Workflow["help"]; updated?: string };

export async function allWorkflows(): Promise<Workflow[]> {
  const { data } = await createAdminClient().from("content_entries").select("slug, doc, meta, status").eq("kind", "use_case").order("sort");
  const byCode = new Map(workflows.map((w) => [w.slug, w]));
  const fromDb = (data ?? []).map((r): Workflow => {
    const base = byCode.get(r.slug);
    const m = (r.meta ?? {}) as Meta;
    return {
      slug: r.slug, status: r.status === "published" ? "published" : "draft", updated: m.updated ?? base?.updated ?? "", category: m.category ?? base?.category ?? "find",
      template: m.template ?? base?.template, related: m.related ?? base?.related ?? [], help: m.help ?? base?.help ?? [], text: r.doc as unknown as Localized<WorkflowText>,
    };
  });
  const seen = new Set(fromDb.map((w) => w.slug));
  return [...fromDb, ...workflows.filter((w) => !seen.has(w.slug))].filter((w) => w.status === "published");
}
