import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { runGrounded, LlmNotConfiguredError } from "@/lib/ai/llm";
import { registrableDomain } from "@/lib/intel/identity";
import { readSite } from "@/lib/intel/socials";
import type { WorkspaceRow } from "@/types/database";

// Competitor discovery (owner brief 2026-10-21, D-251). Yolias AI (Gemini,
// grounded in Google Search) names the companies that sell what this company
// sells to the same customers, from what the company says about itself. A
// suggestion is kept only when its website opens; "high" confidence when
// Google's sources for the answer include that website, else "medium". No
// claims are stored about them beyond what they sell, in a sentence, and why
// they compete. They are never put into outreach emails (contextText keeps
// competitors out unless asked).

const Found = z.object({
  competitors: z.array(z.object({
    name: z.string().trim().min(2).max(160),
    website: z.string().trim().min(4).max(300),
    kind: z.enum(["direct", "indirect"]),
    sells: z.string().trim().max(400).nullable().optional(),
    why: z.string().trim().max(400).nullable().optional(),
  })).max(12),
});

export type DiscoverResult = { ok: true; added: number; checked: number; skipped: number } | { ok: false; error: "no_profile" | "not_configured" | "failed" };

const brief = (ws: WorkspaceRow) => [
  `Company: ${ws.name ?? ""}`,
  ws.website ? `Website: ${ws.website}` : "",
  ws.industry ? `Industry: ${ws.industry}` : "",
  ws.offering ? `What it sells: ${ws.offering}` : "",
  ws.ideal_customer ? `Its customers: ${ws.ideal_customer}` : "",
  ws.target_markets ? `Markets: ${ws.target_markets}` : "",
].filter(Boolean).join("\n");

function parse(text: string) {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  try {
    const r = Found.safeParse(JSON.parse(json));
    return r.success ? r.data.competitors : null;
  } catch {
    return null;
  }
}

/** Finds real competitors and adds the new ones to Company Knowledge. */
export async function discoverCompetitors(ws: WorkspaceRow, userId: string): Promise<DiscoverResult> {
  if (!ws.offering && !ws.website && !ws.industry) return { ok: false, error: "no_profile" };
  let answer: Awaited<ReturnType<typeof runGrounded>>;
  try {
    answer = await runGrounded(
      "knowledge.competitors",
      "You research markets with Google Search. List only real, currently operating companies you found in your search results. Never invent a company or a website. Answer with one JSON object only.",
      `${brief(ws)}\n\nFind up to 8 competitors of this company. "direct": sells the same kind of product or service to the same kind of customer in the same markets. "indirect": solves the same problem in another way or for a nearby segment. Do not list the company itself, marketplaces or general directories. For each: the official website, what it sells in one short sentence, and why it competes in one short sentence. Answer as {"competitors":[{"name":"","website":"","kind":"direct|indirect","sells":"","why":""}]}.`,
      { workspaceId: ws.id },
    );
  } catch (e) {
    return { ok: false, error: e instanceof LlmNotConfiguredError ? "not_configured" : "failed" };
  }
  const found = parse(answer.text);
  if (!found) return { ok: false, error: "failed" };

  const own = registrableDomain(ws.website);
  const sourceDomains = new Set(answer.sources.map((s) => registrableDomain(s.title) ?? registrableDomain(s.uri)).filter(Boolean));
  const db = createAdminClient();
  const { data: existing } = await db.from("competitors").select("name, website").eq("workspace_id", ws.id);
  const haveNames = new Set((existing ?? []).map((c) => c.name.trim().toLowerCase()));
  const haveDomains = new Set((existing ?? []).map((c) => registrableDomain(c.website)).filter(Boolean));
  let added = 0;
  let skipped = 0;
  for (const c of found.slice(0, 8)) {
    const domain = registrableDomain(c.website);
    if (!domain || domain === own || haveDomains.has(domain) || haveNames.has(c.name.toLowerCase())) { skipped++; continue; }
    // The website must really exist; a model can be wrong about it.
    const site = await readSite(`https://${domain}`).catch(() => null);
    if (!site) { skipped++; continue; }
    const now = new Date().toISOString();
    const grounded = sourceDomains.has(domain);
    const { error } = await db.from("competitors").insert({
      workspace_id: ws.id, created_by: userId, name: c.name, website: `https://${domain}`,
      description: c.sells ?? site.description ?? null, differences: c.why ?? null,
      kind: c.kind, source: "ai_research", source_url: grounded ? answer.sources.find((s) => (registrableDomain(s.title) ?? registrableDomain(s.uri)) === domain)?.uri ?? `https://${domain}` : `https://${domain}`,
      confidence: grounded ? "high" : "medium", discovered_at: now, verified_at: now,
    });
    if (error) { skipped++; continue; }
    haveDomains.add(domain);
    haveNames.add(c.name.toLowerCase());
    added++;
  }
  return { ok: true, added, checked: found.length, skipped };
}
