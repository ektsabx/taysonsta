import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { mailboxProvider, MailboxError } from "@/lib/mailbox";
import { siteUrl } from "@/lib/email/notify";

// Connect Gmail / Outlook (D-228): sends the member to the provider's consent
// screen. A random state in an httpOnly cookie ties the callback to this browser.
const STATE_COOKIE = "yolias_mailbox_state";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== "gmail" && provider !== "outlook") return NextResponse.json({ error: "notFound" }, { status: 404 });
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", siteUrl()));
  const nonce = crypto.randomUUID();
  try {
    const url = await mailboxProvider(provider).authorizeUrl(`${provider}.${nonce}`, `${siteUrl()}/api/integrations/${provider}/callback`);
    const res = NextResponse.redirect(url);
    res.cookies.set(STATE_COOKIE, `${provider}.${nonce}`, { httpOnly: true, secure: siteUrl().startsWith("https://"), sameSite: "lax", path: "/api/integrations", maxAge: 600 });
    return res;
  } catch (e) {
    const reason = e instanceof MailboxError && e.kind === "not_configured" ? "not_configured" : "failed";
    return NextResponse.redirect(new URL(`/integrations?mailbox=${reason}`, siteUrl()));
  }
}
