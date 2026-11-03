import "server-only";

// Rate limits on the public endpoints (audit, 2026-11-03): Cloudflare's
// Workers rate limiting binding (wrangler.jsonc "ratelimits"), keyed by the
// endpoint and the visitor's IP. Locally, without the binding, nothing is
// limited.

type Limiter = { limit(o: { key: string }): Promise<{ success: boolean }> };
export type LimiterName = "PUBLIC_LIMITER" | "STRICT_LIMITER";

function ipOf(req: Request): string {
  const h = req.headers;
  return h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** true when this request is over its limit and should get a 429. Never throws. */
export async function overLimit(req: Request, endpoint: string, name: LimiterName = "PUBLIC_LIMITER"): Promise<boolean> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const limiter = (getCloudflareContext().env as unknown as Record<string, Limiter | undefined>)[name];
    if (!limiter) return false;
    const { success } = await limiter.limit({ key: `${endpoint}:${ipOf(req)}` });
    return !success;
  } catch {
    return false;
  }
}

export const tooMany = (headers: HeadersInit = {}) => new Response(null, { status: 429, headers: { "Retry-After": "60", ...headers } });
