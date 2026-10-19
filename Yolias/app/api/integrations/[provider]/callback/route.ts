import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { mailboxProvider, saveMailbox } from "@/lib/mailbox";
import { siteUrl } from "@/lib/email/notify";

const STATE_COOKIE = "yolias_mailbox_state";

// The provider sends the member back here with a one-time code (D-228). The
// code becomes a refresh token kept in Vault; nothing reaches the browser.
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/?settings=integration&mailbox=${status}`, siteUrl()));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/integrations" });
    return res;
  };
  if (provider !== "gmail" && provider !== "outlook") return back("failed");
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", siteUrl()));
  const q = req.nextUrl.searchParams;
  const expected = (await cookies()).get(STATE_COOKIE)?.value;
  if (!expected || q.get("state") !== expected || !expected.startsWith(`${provider}.`)) return back("failed");
  if (q.get("error")) return back("denied");
  const code = q.get("code");
  if (!code) return back("failed");
  try {
    const account = await mailboxProvider(provider).exchange(code, `${siteUrl()}/api/integrations/${provider}/callback`);
    await saveMailbox({ workspaceId: session.workspace.id, userId: session.userId, provider, ...account });
    return back("connected");
  } catch (e) {
    console.error("[mailbox] connect failed", e instanceof Error ? e.message : e);
    return back("failed");
  }
}
