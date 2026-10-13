// Browser half of the journey tracking (D-212). Sends a page view or click
// to /api/funnel. A visitor id is kept only after "Accept all" cookies.
import { readConsent } from "@/lib/analytics/consent";

const VID = "yolias_vid";

function visitorId(): string | null {
  if (readConsent() !== "all") return null;
  try {
    let v = localStorage.getItem(VID);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(VID, v);
    }
    return v;
  } catch {
    return null;
  }
}

export function funnelEvent(name: "plans_viewed" | "plan_selected", props: { plan?: string; period?: string } = {}) {
  try {
    const body = JSON.stringify({ name, id: crypto.randomUUID(), vid: visitorId(), path: location.pathname, ...props });
    if (navigator.sendBeacon?.(new URL("/api/funnel", location.origin), new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/funnel", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    // tracking never breaks the page
  }
}
