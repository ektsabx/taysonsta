import "server-only";
import { ydb } from "@/lib/yolias/db";
import { audit } from "@/lib/bos/audit";
import { ValidationError } from "@/lib/bos/errors";
import type { BosUser } from "@/lib/bos/auth";

// Use cases in Yolias Admin (owner, 2026-11-05): rows in content_entries (kind
// use_case). What is saved here is what the website shows.

export const SHOTS = ["knowledge", "integrations", "builder", "audience", "signals", "message", "campaign", "campaigns", "leads", "companies", "inbox", "meetings", "audiences", "lookalike"] as const;
const SLUG = /^[a-z0-9][a-z0-9-]{1,79}$/;

export async function listUseCases() {
  const { data, error } = await ydb().from("content_entries").select("slug, status, doc, updated_at").eq("kind", "use_case").order("sort");
  if (error) throw error;
  return data ?? [];
}

export async function getUseCase(slug: string) {
  const { data } = await ydb().from("content_entries").select("slug, status, doc, meta").eq("kind", "use_case").eq("slug", slug).maybeSingle();
  return data;
}

export async function saveUseCase(bos: BosUser, input: { slug: string; status: string; doc: unknown; meta: unknown }) {
  if (!SLUG.test(input.slug)) throw new ValidationError("الرابط حروف إنجليزية صغيرة وأرقام وشرطات فقط.", { slug: "رابط غير صحيح" });
  const doc = input.doc as Record<"en" | "ar", { name?: string; title?: string; steps?: unknown[] }>;
  for (const l of ["en", "ar"] as const) if (!doc?.[l]?.title?.trim() || !doc[l].steps?.length) throw new ValidationError("أكمل العنوان وخطوة واحدة على الأقل باللغتين.");
  const row = { kind: "use_case", slug: input.slug, status: input.status === "published" ? "published" : "draft", doc: JSON.parse(JSON.stringify(doc)), meta: JSON.parse(JSON.stringify({ ...(input.meta as object), updated: new Date().toISOString().slice(0, 10) })), updated_by: bos.email, published_at: new Date().toISOString() };
  const { error } = await ydb().from("content_entries").upsert(row as never, { onConflict: "kind,slug" });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.use_case.save", entityType: "yolias_use_case", entityId: null, metadata: { slug: input.slug, status: row.status } });
}
