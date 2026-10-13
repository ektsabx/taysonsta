"use client";

import { unstable_rethrow } from "next/navigation";
import { isNetworkError, type NetworkFailure } from "./network-error";

// Server actions from the browser. A dropped connection (mobile networks,
// long sessions) rejects the action with a TypeError; inside a transition
// that would replace the page with the error screen. callAction turns it into
// a result the form can show with a retry, and lets Next's redirects through.

export { isNetworkError, isNetworkFailure, type NetworkFailure } from "./network-error";

export async function callAction<T>(run: () => Promise<T>): Promise<T | NetworkFailure> {
  try {
    return await run();
  } catch (e) {
    unstable_rethrow(e);
    if (isNetworkError(e)) return { ok: false, network: true };
    throw e;
  }
}
