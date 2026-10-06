import type { NextRequest } from "next/server";

/** One-time OAuth state for connecting a mailbox: "provider:state:userId", httpOnly, 10 minutes. */
export const STATE_COOKIE = "yolias_oauth_state";

/** Where the provider sends the member back (must be registered on the OAuth client). */
export function callbackUrl(request: NextRequest, provider: string): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, "");
  return `${site}/api/integrations/${provider}/callback`;
}
