import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { deviceOf, trackEvent } from "@/lib/funnel";

// Browser-side journey events (D-212): only page views and clicks that the
// server can't see. They are stored as unconfirmed (confirmed = false).
// Signed-in members are identified by their session on the server (never by
// what the browser sends). Visitors are counted per browser only when they
// accepted analytics cookies (the id is then sent from localStorage);
// otherwise the event has no person attached. Each event carries a random id
// from the browser, so a retried request is stored once.

const ALLOWED = new Set(["plans_viewed", "plan_selected"]);
const PLANS = new Set(["pro", "growth", "scale"]);
const PERIODS = new Set(["monthly", "annual"]);

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { name?: unknown; id?: unknown; vid?: unknown; plan?: unknown; period?: unknown; path?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name : "";
  const id = typeof body?.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
  if (!ALLOWED.has(name) || !id) return NextResponse.json({ ok: false }, { status: 400 });
  const vid = typeof body?.vid === "string" && /^[0-9a-f-]{36}$/i.test(body.vid) ? body.vid : null;
  const plan = typeof body?.plan === "string" && PLANS.has(body.plan) ? body.plan : null;
  const period = typeof body?.period === "string" && PERIODS.has(body.period) ? body.period : null;
  const session = await getSession().catch(() => null);
  const d = deviceOf(request.headers.get("user-agent"));
  await trackEvent({
    name, key: `${name}:${id}`, userId: session?.userId ?? null, workspaceId: session?.workspace.id ?? null, visitorId: session ? null : vid,
    plan, period, confirmed: false, source: "client",
    props: { device: d.device, path: typeof body?.path === "string" ? body.path.slice(0, 80) : null },
  });
  return NextResponse.json({ ok: true });
}
