import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { pingAppSession } from "@/lib/funnel";
import { tagAppSession } from "@/lib/visits";

// "Yolias is open" (D-214): the app pings this while a tab is visible. One
// app session lasts until 30 minutes without a ping. Only the signed-in
// member's own session is recorded; nothing is read back.
export async function POST(request: NextRequest) {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  await pingAppSession(session.userId, session.workspace.id, request.headers.get("user-agent"));
  // D-276: the session's country, city and address (Admin → live users).
  await tagAppSession(request, session.userId);
  return NextResponse.json({ ok: true });
}
