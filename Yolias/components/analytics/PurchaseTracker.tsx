"use client";

import { useEffect } from "react";
import { metaTrack, track } from "@/lib/analytics/client";

// After a successful payment (billing result page): Meta "Purchase" with the
// value of what was actually bought, once per payment (the payment id is the
// event id, so a reload or a second tab doesn't count twice). Test-mode
// payments reach PostHog only, never Meta.
export function PurchaseTracker({ paymentId, value, currency, kind, item, live }: { paymentId: string; value: number; currency: string; kind: string; item: string; live: boolean }) {
  useEffect(() => {
    const key = `yolias_purchase_${paymentId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // Private mode: Meta still drops the duplicate by event id.
    }
    track("purchase_confirmed", { payment_id: paymentId, value, currency, kind, item, live });
    if (live) metaTrack("Purchase", { value, currency, content_type: "product", content_ids: [item], num_items: 1 }, paymentId);
  }, [paymentId, value, currency, kind, item, live]);
  return null;
}
