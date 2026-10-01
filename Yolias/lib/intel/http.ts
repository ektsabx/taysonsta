// Outbound HTTP for adapters: timeout, retries with exponential backoff on
// network errors, 429 and 5xx, honouring Retry-After (docs/05 "Failure handling").

export interface ProviderRequest {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
}

export interface FetchResult {
  ok: boolean;
  status: number;
  body: unknown;
  attempts: number;
  latencyMs: number;
  error: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function retryDelayMs(attempt: number, retryAfter: string | null, now = Date.now()): number {
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs)) return Math.min(secs * 1000, 30_000);
    const at = Date.parse(retryAfter);
    if (Number.isFinite(at)) return Math.min(Math.max(at - now, 0), 30_000);
  }
  return Math.min(500 * 2 ** (attempt - 1), 8_000);
}

export function retryable(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function providerFetch(req: ProviderRequest): Promise<FetchResult> {
  const retries = req.retries ?? 2;
  const started = Date.now();
  let attempt = 0;
  let last: FetchResult = { ok: false, status: 0, body: null, attempts: 0, latencyMs: 0, error: "not sent" };
  while (attempt <= retries) {
    attempt++;
    try {
      const isJson = req.body !== undefined && typeof req.body !== "string" && !(req.body instanceof FormData);
      const res = await fetch(req.url, {
        method: req.method ?? (req.body === undefined ? "GET" : "POST"),
        headers: { ...(isJson ? { "content-type": "application/json" } : {}), ...req.headers },
        body: req.body === undefined ? undefined : isJson ? JSON.stringify(req.body) : (req.body as BodyInit),
        signal: AbortSignal.timeout(req.timeoutMs ?? 20_000),
      });
      const text = await res.text();
      let body: unknown = text;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        /* not JSON */
      }
      last = { ok: res.ok, status: res.status, body, attempts: attempt, latencyMs: Date.now() - started, error: res.ok ? null : `HTTP ${res.status}` };
      if (res.ok || !retryable(res.status) || attempt > retries) return last;
      await sleep(retryDelayMs(attempt, res.headers.get("retry-after")));
    } catch (e) {
      last = { ok: false, status: 0, body: null, attempts: attempt, latencyMs: Date.now() - started, error: e instanceof Error ? e.message : "network error" };
      if (attempt > retries) return last;
      await sleep(retryDelayMs(attempt, null));
    }
  }
  return last;
}
