import "server-only";
import { ydb } from "@/lib/yolias/db";
import { audit } from "@/lib/bos/audit";
import { ValidationError } from "@/lib/bos/errors";
import type { BosUser } from "@/lib/bos/auth";
import { rates, type AnswerRow, type Rates } from "../../Yolias/lib/ai-visibility/analyze";

// GEO tracking (owner, 2026-11-03, D-277): the weekly questions Yolias asks
// ChatGPT, Gemini and Perplexity, and what their answers say about Yolias
// and its competitors. Read here; asked by the Yolias worker.

export const GEO_ENGINES = ["openai", "gemini", "perplexity"] as const;
export const ENGINE_LABEL: Record<string, string> = { openai: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity" };

export interface GeoPrompt { id: string; text: string; lang: string; topic: string | null; active: boolean }
export interface GeoRun { id: string; started_at: string; finished_at: string | null; status: string; engines: string[]; total: number; trigger: string }
export interface GeoAnswer extends AnswerRow { prompt_id: string; status: string; answer: string | null; citations: string[]; error: string | null }

export interface GeoDashboard {
  engines: string[];
  prompts: GeoPrompt[];
  runs: (GeoRun & { rates: Rates; done: number; failed: number })[];
  latest: (GeoRun & { rates: Rates; done: number; failed: number }) | null;
  previous: (GeoRun & { rates: Rates }) | null;
  byEngine: { engine: string; rates: Rates }[];
  answers: GeoAnswer[];
}

export async function geoDashboard(): Promise<GeoDashboard> {
  const db = ydb();
  const [{ data: keys }, { data: prompts }, { data: runs }] = await Promise.all([
    db.from("integration_keys").select("provider").in("provider", [...GEO_ENGINES]),
    db.from("geo_prompts").select("id, text, lang, topic, active").order("created_at"),
    db.from("geo_runs").select("*").order("started_at", { ascending: false }).limit(12),
  ]);
  const ids = (runs ?? []).map((r) => r.id);
  const { data: rows } = ids.length
    ? await db.from("geo_answers").select("run_id, prompt_id, engine, status, mentioned, first_pick, cited, brands, answer, citations, error").in("run_id", ids).limit(5000)
    : { data: [] };
  const all = (rows ?? []) as unknown as (GeoAnswer & { run_id: string })[];
  const withRates = (runs ?? []).map((r) => {
    const mine = all.filter((a) => a.run_id === r.id);
    const done = mine.filter((a) => a.status === "done");
    return { ...r, rates: rates(done), done: done.length, failed: mine.filter((a) => a.status === "failed").length };
  });
  // The latest run with answers; a run in progress shows its progress on top.
  const latest = withRates.find((r) => r.done > 0) ?? withRates[0] ?? null;
  const previous = latest ? withRates.slice(withRates.indexOf(latest) + 1).find((r) => r.done > 0) ?? null : null;
  const answers = latest ? all.filter((a) => a.run_id === latest.id) : [];
  const done = answers.filter((a) => a.status === "done");
  return {
    engines: (keys ?? []).map((k) => k.provider),
    prompts: prompts ?? [],
    runs: withRates,
    latest,
    previous,
    byEngine: GEO_ENGINES.map((engine) => ({ engine, rates: rates(done.filter((a) => a.engine === engine)) })).filter((e) => e.rates.answers > 0),
    answers,
  };
}

export async function addGeoPrompt(bos: BosUser, input: { text: string; lang: string; topic?: string | null }) {
  const text = input.text.trim();
  if (text.length < 5 || text.length > 500) throw new ValidationError("السؤال قصير أو طويل جدًا.", { text: "من 5 إلى 500 حرف" });
  const lang = input.lang === "ar" ? "ar" : "en";
  const { data, error } = await ydb().from("geo_prompts").insert({ text, lang, topic: input.topic?.trim() || null }).select("id").single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.geo.prompt_add", entityType: "yolias_geo_prompt", entityId: data.id, newValue: { text, lang } });
}

export async function setGeoPromptActive(bos: BosUser, id: string, active: boolean) {
  const { error } = await ydb().from("geo_prompts").update({ active }).eq("id", id);
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.geo.prompt_active", entityType: "yolias_geo_prompt", entityId: id, newValue: { active } });
}

export async function deleteGeoPrompt(bos: BosUser, id: string) {
  const { data } = await ydb().from("geo_prompts").select("text").eq("id", id).maybeSingle();
  const { error } = await ydb().from("geo_prompts").delete().eq("id", id);
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.geo.prompt_delete", entityType: "yolias_geo_prompt", entityId: id, oldValue: data });
}

/** Starts a run now; the Yolias worker adds the questions and asks them. */
export async function startGeoRun(bos: BosUser) {
  const db = ydb();
  const { data: running } = await db.from("geo_runs").select("id").eq("status", "running").limit(1).maybeSingle();
  if (running) throw new ValidationError("هناك قياس يعمل الآن.");
  const { data: keys } = await db.from("integration_keys").select("provider").in("provider", [...GEO_ENGINES]);
  if (!keys?.length) throw new ValidationError("أضف مفتاح OpenAI أو Gemini أو Perplexity في التكاملات أولًا.");
  const { data, error } = await db.from("geo_runs").insert({ trigger: "manual" }).select("id").single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.geo.run", entityType: "yolias_geo_run", entityId: data.id });
}
