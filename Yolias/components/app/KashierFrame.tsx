"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Lock } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { confirmCheckoutPayment } from "@/app/checkout/actions";

// Kashier's payment page inside Yolias's checkout (D-235): the customer types
// the card on Kashier's page (card data never touches Yolias) without leaving
// our site. Kashier's "success" message is only a hint: the payment is
// confirmed with Kashier's API (and its signed webhook) before anything starts.
export function KashierFrame({ url, paymentId, onCancel }: { url: string; paymentId: string; onCancel?: () => void }) {
  const { t } = useI18n();
  const c = t.checkout;
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ready" | "confirming" | "failed">("loading");
  const done = useRef(false);

  useEffect(() => {
    let stopped = false;
    const finish = (failed = false) => {
      if (done.current) return;
      done.current = true;
      router.push(`/billing/result?payment=${paymentId}${failed ? "&failed=1" : ""}`);
    };
    const check = async () => {
      const r = await confirmCheckoutPayment(paymentId).catch(() => null);
      if (r?.status === "succeeded") finish();
      else if (r?.status === "failed") { setState("failed"); }
      return r?.status;
    };
    const onMessage = (e: MessageEvent) => {
      let host = "";
      try { host = new URL(e.origin).hostname; } catch { return; }
      if (host !== "kashier.io" && !host.endsWith(".kashier.io")) return;
      const msg = typeof e.data === "object" && e.data ? String((e.data as { message?: unknown }).message ?? "") : String(e.data ?? "");
      if (msg === "iframeLoaded") setState("ready");
      if (/success/i.test(msg)) {
        setState("confirming");
        void (async () => {
          for (let i = 0; i < 15 && !stopped; i++) {
            const s = await check();
            if (s === "succeeded" || s === "failed") return;
            await new Promise((r) => setTimeout(r, 2000));
          }
        })();
      }
    };
    window.addEventListener("message", onMessage);
    // The webhook may settle it first (e.g. 3-D Secure in another step): check now and then.
    const id = window.setInterval(() => { if (!done.current) void check(); }, 8000);
    return () => { stopped = true; window.removeEventListener("message", onMessage); window.clearInterval(id); };
  }, [paymentId, router]);

  return (
    <div className="kashier-frame">
      <div className="kashier-frame-head">
        <span><Lock aria-hidden="true" /> {c.securePayment}</span>
        {onCancel && state !== "confirming" ? <button type="button" className="link-button" onClick={onCancel}>{c.changePlan}</button> : null}
      </div>
      {state === "loading" && <div className="kashier-frame-loading"><LoaderCircle className="spin" /> {c.openingPayment}</div>}
      {state === "confirming" && <div className="kashier-frame-loading" role="status"><LoaderCircle className="spin" /> {c.confirmingPayment}</div>}
      {state === "failed" && <p className="form-error" role="alert">{c.errors.paymentFailed}</p>}
      <iframe
        src={url}
        title={c.securePayment}
        className="kashier-frame-iframe"
        allow="payment *"
        onLoad={() => setState((s) => (s === "loading" ? "ready" : s))}
      />
    </div>
  );
}
