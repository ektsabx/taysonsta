import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canManageTeam, getSession } from "@/lib/session";
import { canUseApp } from "@/lib/plans";
import { getDictionary } from "@/lib/i18n/server";
import { analyzeWebsite, type AnalysisProgress, type WebsiteAnalysis } from "@/lib/website-analysis";

const BodySchema = z.object({
  url: z.string().trim().min(1).max(300),
  /** Company Knowledge / Customer Profiles (owners and admins), or onboarding (the workspace owner). */
  context: z.enum(["knowledge", "onboarding"]),
});

export type AnalysisStreamEvent =
  | ({ type: "progress" } & AnalysisProgress)
  | { type: "done"; data: WebsiteAnalysis }
  | { type: "error"; error: string };

// Analyze website (D-232) with its real progress (owner brief 2026-10-20):
// NDJSON events as each step starts or finishes, then the result for review.
// Nothing is saved here. Same permissions as the server actions it replaces.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const t = (await getDictionary()).ws;
  const errors = t.ai.knowledge.analyze.errors;
  const allowed = body.data.context === "onboarding"
    ? session.role === "owner" && canUseApp(session.workspace)
    : canUseApp(session.workspace) && Boolean(session.profile.onboarded_at) && canManageTeam(session);
  if (!allowed) return NextResponse.json({ error: body.data.context === "onboarding" ? errors.failed : t.common.onlyManagers }, { status: 403 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = (e: AnalysisStreamEvent) => {
        if (!open) return;
        try { controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`)); } catch { open = false; }
      };
      try {
        const r = await analyzeWebsite(body.data.url, session.workspace.id, (p) => send({ type: "progress", ...p }));
        send(r.ok ? { type: "done", data: r.data } : { type: "error", error: errors[r.error] });
      } catch {
        send({ type: "error", error: errors.failed });
      } finally {
        open = false;
        try { controller.close(); } catch { /* the browser left */ }
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
