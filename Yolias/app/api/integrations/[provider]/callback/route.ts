import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMailProvider, mailers } from "@/lib/outreach/mailers";
import { callbackUrl, STATE_COOKIE } from "@/lib/outreach/oauth";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// The provider sends the member back here: check the one-time state, swap
// the code for tokens, keep only the refresh token (Vault) and the mailbox
// address. Never logs or returns a token.
export async function GET(request: NextRequest, { params }: RouteContext<"/api/integrations/[provider]/callback">) {
  const { provider } = await params;
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/outreach?mailbox=${status}`, request.url));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/integrations" });
    return res;
  };
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!isMailProvider(provider)) return back("unknown");
  const q = request.nextUrl.searchParams;
  const [cProvider, cState, cUser] = (request.cookies.get(STATE_COOKIE)?.value ?? "").split(":");
  if (!cState || cProvider !== provider || cUser !== session.userId || !same(cState, q.get("state") ?? "")) return back("state");
  if (q.get("error") || !q.get("code")) return back("denied");
  const mailer = mailers[provider];
  const app = mailer.app();
  if (!app) return back("not_configured");
  try {
    const t = await mailer.exchange(app, q.get("code")!, callbackUrl(request, provider));
    const db = createAdminClient();
    const { data: box, error } = await db.from("mailboxes").upsert({
      workspace_id: session.workspace.id, user_id: session.userId, provider, email: t.email, status: "connected", last_error: null, connected_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,user_id,provider" }).select("id").single();
    if (error || !box) throw error ?? new Error("mailbox save failed");
    const { error: vaultError } = await db.rpc("set_mailbox_token", { p_mailbox: box.id, p_token: t.refreshToken });
    if (vaultError) throw vaultError;
    return back("connected");
  } catch (e) {
    console.error("[outreach] mailbox connect failed", e instanceof Error ? e.message : e);
    return back("error");
  }
}
