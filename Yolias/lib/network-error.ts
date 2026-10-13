// A fetch that never reached the server: "Failed to fetch" (Chrome), "Load
// failed" (Safari), "NetworkError …" (Firefox), "network error", "The network
// connection was lost." Always a TypeError. Used by lib/action-client.ts and
// the error page.
export function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError && /failed to fetch|load failed|networkerror|network error|network connection was lost/i.test(e.message);
}

export type NetworkFailure = { ok: false; network: true };

export function isNetworkFailure(r: unknown): r is NetworkFailure {
  return typeof r === "object" && r !== null && (r as NetworkFailure).network === true;
}
