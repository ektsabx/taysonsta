import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadIntegrations } from "@/lib/integrations";
import { analyze, type Brand } from "@/lib/ai-visibility/analyze";
import { ask, engineReady, GEO_ENGINES, type GeoEngine } from "@/lib/ai-visibility/engines";

// GEO tracking (D-277). Every worker call: start the weekly run when a week
// has passed, fill a run the owner started from Admin, and answer a few
// questions (one per engine, in parallel) until the run is done.

const WEEK_MS = 7 * 24 * 60 * 60_000;
const STALE_MS = 5 * 60_000;
const MAX_ATTEMPTS = 2;

async function readyEngines(): Promise<GeoEngine[]> {
  await loadIntegrations();
  return GEO_ENGINES.filter(engineReady);
}

/** Adds one question per active prompt and ready engine to a run. */
async function fill(runId: string, engines: GeoEngine[]): Promise<void> {
  const db = createAdminClient();
  const { data: prompts } = await db.from("geo_prompts").select("id").eq("active", true);
  const rows = (prompts ?? []).flatMap((p) => engines.map((engine) => ({ run_id: runId, prompt_id: p.id, engine })));
  if (rows.length) await db.from("geo_answers").upsert(rows, { onConflict: "run_id,prompt_id,engine", ignoreDuplicates: true });
  await db.from("geo_runs").update({ engines, total: rows.length, ...(rows.length ? {} : { status: "done", finished_at: new Date().toISOString() }) }).eq("id", runId);
}

async function scheduleWeekly(engines: GeoEngine[]): Promise<void> {
  if (!engines.length) return;
  const db = createAdminClient();
  const { data: last } = await db.from("geo_runs").select("started_at").order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (last && Date.now() - new Date(last.started_at).getTime() < WEEK_MS) return;
  // One caller wins the week (worker_state is the lock).
  const key = `geo.week.${Math.floor(Date.now() / WEEK_MS)}`;
  const { data: won } = await db.from("worker_state").upsert({ key, value: {}, updated_at: new Date().toISOString() }, { onConflict: "key", ignoreDuplicates: true }).select("key");
  if (!won?.length) return;
  const { data: run } = await db.from("geo_runs").insert({ trigger: "weekly" }).select("id").single();
  if (run) await fill(run.id, engines);
}

export async function geoSweep({ perTick = 1 } = {}): Promise<number> {
  const db = createAdminClient();
  const engines = await readyEngines();
  await scheduleWeekly(engines);
  // A run started from Admin has no questions yet.
  const { data: empty } = await db.from("geo_runs").select("id").eq("status", "running").eq("total", 0).limit(1);
  for (const r of empty ?? []) await fill(r.id, engines);

  const { data: open } = await db.from("geo_runs").select("id").eq("status", "running").gt("total", 0).order("started_at").limit(1).maybeSingle();
  if (!open) return 0;
  const stale = new Date(Date.now() - STALE_MS).toISOString();
  const { data: brandsRows } = await db.from("seo_competitors").select("name, website");
  const competitors: Brand[] = brandsRows ?? [];
  let answered = 0;
  for (let i = 0; i < perTick; i++) {
    const batch = await Promise.all(engines.map(async (engine) => {
      const { data: next } = await db.from("geo_answers").select("id, attempts, prompt_id").eq("run_id", open.id).eq("engine", engine)
        .or(`status.eq.pending,and(status.eq.working,claimed_at.lt.${stale})`).limit(1).maybeSingle();
      if (!next) return 0;
      const { data: claimed } = await db.from("geo_answers").update({ status: "working", claimed_at: new Date().toISOString(), attempts: next.attempts + 1 })
        .eq("id", next.id).eq("attempts", next.attempts).select("id").maybeSingle();
      if (!claimed) return 0;
      const { data: prompt } = await db.from("geo_prompts").select("text").eq("id", next.prompt_id).single();
      try {
        const a = await ask(engine, prompt?.text ?? "");
        const r = analyze(a.text, a.citations, competitors);
        await db.from("geo_answers").update({ status: "done", answer: a.text.slice(0, 20_000), citations: a.citations.slice(0, 40), mentioned: r.mentioned, first_pick: r.firstPick, cited: r.cited, brands: r.brands, error: null, answered_at: new Date().toISOString() }).eq("id", next.id);
        return 1;
      } catch (e) {
        const failed = next.attempts + 1 >= MAX_ATTEMPTS;
        await db.from("geo_answers").update({ status: failed ? "failed" : "pending", error: String(e instanceof Error ? e.message : e).slice(0, 500) }).eq("id", next.id);
        return 0;
      }
    }));
    answered += batch.reduce<number>((a, b) => a + b, 0);
  }
  const { count } = await db.from("geo_answers").select("id", { count: "exact", head: true }).eq("run_id", open.id).in("status", ["pending", "working"]);
  if (!count) await db.from("geo_runs").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", open.id).eq("status", "running");
  return answered;
}
