"use client";
import { nowIso } from "@/lib/bos/clock";

import { useActionState, useState } from "react";
import { clientDecisionAction, type DecisionState } from "./actions";

const initial: DecisionState = { ok: false, error: null };

export function ClientDecision({ slug, status, validUntil }: { slug: string; status: string; validUntil: string | null }) {
  const [state, action, pending] = useActionState(clientDecisionAction.bind(null, slug), initial);
  const [rejecting, setRejecting] = useState(false);
  const expired = validUntil ? validUntil < nowIso().slice(0, 10) : false;

  if (status === "accepted") return <div className="proposal-decision proposal-decision-done">تم قبول المقترح. شكراً لثقتكم — سيتواصل معكم فريقنا لبدء الخطوات التالية.</div>;
  if (status === "rejected") return <div className="proposal-decision proposal-decision-done">تم تسجيل رفض المقترح. شكراً لوقتكم.</div>;
  if (status === "expired" || expired) return <div className="proposal-decision proposal-decision-done">انتهت صلاحية هذا المقترح. تواصلوا معنا للحصول على نسخة محدثة.</div>;
  if (state.ok) return <div className="proposal-decision proposal-decision-done">تم تسجيل قراركم. شكراً لكم.</div>;

  return (
    <form action={action} className="proposal-decision">
      <p>هل توافقون على هذا المقترح{validUntil ? ` (صالح حتى ${validUntil})` : ""}؟</p>
      {rejecting ? (
        <>
          <textarea name="reason" placeholder="سبب الرفض (مطلوب)" required rows={3} />
          <div className="proposal-decision-actions">
            <button type="submit" name="decision" value="reject" disabled={pending}>
              تأكيد الرفض
            </button>
            <button type="button" onClick={() => setRejecting(false)} disabled={pending}>
              رجوع
            </button>
          </div>
        </>
      ) : (
        <div className="proposal-decision-actions">
          <button type="submit" name="decision" value="accept" disabled={pending} className="primary">
            {pending ? "جارٍ التسجيل..." : "قبول المقترح"}
          </button>
          <button type="button" onClick={() => setRejecting(true)} disabled={pending}>
            رفض
          </button>
        </div>
      )}
      {state.error ? <p className="proposal-decision-error">{state.error}</p> : null}
    </form>
  );
}
