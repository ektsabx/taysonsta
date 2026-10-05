import { nowMs } from "@/lib/bos/clock";
import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getBosSession, can } from "@/lib/bos/auth";
import { runScheduledSweep } from "@/services/bos/sweep";

// Scheduled sweep endpoint. Called by the platform scheduler (Cloudflare Cron
// Trigger / any cron) with `Authorization: Bearer $CRON_SECRET`, or manually
// by staff with automation.manage.
function secretOk(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: NextRequest) {
  let actor: string | null = null;
  if (!secretOk(request)) {
    const session = await getBosSession();
    if (session.status !== "ok" || !can(session.bos, "settings.manage", "all")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    actor = session.bos.userId;
  }
  const started = nowMs();
  const results = await runScheduledSweep({ actor });
  return NextResponse.json({ ok: results.every((r) => !r.error), durationMs: nowMs() - started, results });
}

export const POST = handle;
export const GET = handle;
