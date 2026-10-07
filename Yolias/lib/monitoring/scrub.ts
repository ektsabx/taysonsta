// Removes what must never leave Yolias in an error report or analytics event:
// sign-in tokens, payment signatures, cookies, auth headers, request bodies
// (they can hold card or form data) and email addresses.

const SECRET_PARAMS = /^(token|token_hash|code|hmac|access_token|refresh_token|id_token|password|secret|key|api_key|apikey|otp|signature|state|session|email)$/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/g;
const SECRET_TOKENS = /\b(sk|pk|rk|re|sbp|sb_secret|sk-ant|sk-proj)[-_][A-Za-z0-9_-]{12,}/g;

/** URL with secret query values replaced by "[Filtered]". Leaves other text alone. */
export function scrubUrl(url: string): string {
  try {
    const u = new URL(url, "http://x");
    let changed = false;
    for (const k of [...u.searchParams.keys()]) {
      if (SECRET_PARAMS.test(k)) { u.searchParams.set(k, "[Filtered]"); changed = true; }
    }
    if (!changed) return url;
    return url.startsWith("http") ? u.toString() : `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return url;
  }
}

/** Free text (messages, breadcrumbs) without emails, bearer tokens or API keys. */
export function scrubText(s: string): string {
  return s.replace(BEARER, "$1 [Filtered]").replace(SECRET_TOKENS, "[Filtered]").replace(EMAIL, "[email]");
}

type Crumb = { message?: string; data?: Record<string, unknown> };
type SentryLike = {
  message?: string;
  user?: { id?: string | number } & Record<string, unknown>;
  request?: { url?: string; query_string?: unknown; cookies?: unknown; data?: unknown; headers?: Record<string, string> };
  breadcrumbs?: Crumb[];
  exception?: { values?: { value?: string }[] };
  extra?: Record<string, unknown>;
};

/** Sentry beforeSend / beforeSendTransaction. */
export function scrubEvent<T>(event: T): T {
  const e = event as SentryLike;
  if (e.user) e.user = e.user.id != null ? { id: e.user.id } : {};
  if (e.request) {
    delete e.request.cookies;
    delete e.request.data;
    delete e.request.query_string;
    if (e.request.url) e.request.url = scrubUrl(e.request.url);
    if (e.request.headers) {
      for (const h of Object.keys(e.request.headers)) {
        if (/^(cookie|authorization|x-api-key|x-worker-secret|apikey)$/i.test(h)) delete e.request.headers[h];
      }
    }
  }
  if (e.message) e.message = scrubText(e.message);
  for (const v of e.exception?.values ?? []) if (v.value) v.value = scrubText(v.value);
  for (const b of e.breadcrumbs ?? []) {
    if (b.message) b.message = scrubText(b.message);
    if (b.data) {
      for (const k of ["url", "to", "from"]) if (typeof b.data[k] === "string") b.data[k] = scrubUrl(b.data[k] as string);
      delete b.data.body;
    }
  }
  return event;
}

/**
 * What Sentry may collect (its v11 defaults collect everything): no user
 * fields, cookies, bodies, query values, AI prompts or local variables; only
 * a few harmless request headers.
 */
export const sentryDataCollection: { httpHeaders: { request: { allow: string[] }; response: boolean }; httpBodies: never[] } & Record<string, unknown> = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { allow: ["user-agent", "accept-language", "content-type", "referer"] }, response: false },
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
};
