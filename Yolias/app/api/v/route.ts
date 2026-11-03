import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { recordVisit } from "@/lib/visits";

// One page view (D-276): sent by the page (components/VisitBeacon.tsx) with
// its path and referrer; lib/visits.ts adds the rest. Always 204: the page
// never waits for or depends on it.
const body = z.object({ p: z.string().max(600).regex(/^\//), r: z.string().max(600).nullable().optional(), v: z.string().max(64).nullable().optional(), l: z.string().max(5).nullable().optional() });

export async function POST(request: NextRequest) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (parsed.success) {
    const session = await getSession().catch(() => null);
    await recordVisit(request, { path: parsed.data.p, referrer: parsed.data.r ?? null, vid: parsed.data.v ?? null, locale: parsed.data.l ?? null, userId: session?.userId ?? null, workspaceId: session?.workspace.id ?? null });
  }
  return new NextResponse(null, { status: 204 });
}
