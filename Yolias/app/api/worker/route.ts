import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { tick } from "@/lib/jobs/worker";

// Background worker entry point (docs/05 "Queue & worker"). Called by the
// Cloudflare Cron Trigger in production and by scripts/dev-worker.mjs
// locally. Protected by WORKER_SECRET; never callable from a browser session.

function authorized(req: NextRequest): boolean {
  const secret = process.env.WORKER_SECRET;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || got.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

export async function POST(req: NextRequest) {
  if (!process.env.WORKER_SECRET) return NextResponse.json({ error: "WORKER_SECRET is not set" }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await tick());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "worker failed" }, { status: 500 });
  }
}
