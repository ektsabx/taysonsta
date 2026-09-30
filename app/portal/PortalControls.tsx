"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/bos/action";
import { portalDecideApprovalAction, portalPostMessageAction, portalReplyTicketAction, portalSatisfactionAction } from "./actions";

export function ApprovalButtons({ id }: { id: string }) {
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const decide = (d: "approved" | "rejected") =>
    start(async () => {
      if (d === "rejected" && !comment.trim()) return setMsg("اكتب سبب الرفض");
      const r = await portalDecideApprovalAction(id, d, comment);
      setMsg(r.ok ? r.message ?? "تم" : r.error);
      router.refresh();
    });
  return (
    <div style={{ marginTop: 8 }}>
      <textarea rows={2} placeholder="تعليق (مطلوب عند الرفض)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button type="button" className="portal-btn" disabled={pending} onClick={() => decide("approved")}>موافقة</button>
        <button type="button" className="portal-btn danger" disabled={pending} onClick={() => decide("rejected")}>رفض</button>
      </div>
      {msg ? <p className="portal-muted">{msg}</p> : null}
    </div>
  );
}

function useForm(action: (s: ActionState, f: FormData) => Promise<ActionState>) {
  return useActionState<ActionState, FormData>(action, { ok: true });
}

export function PortalForm({ action, children, submit, reset }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; children: React.ReactNode; submit: string; reset?: boolean }) {
  const [state, formAction, pending] = useForm(action);
  const router = useRouter();
  return (
    <form
      action={async (fd) => {
        await formAction(fd);
        router.refresh();
      }}
      ref={(el) => { if (el && reset && state.ok && (state as { message?: string }).message) el.reset(); }}
    >
      {children}
      {!state.ok ? <p className="portal-error">{state.error}</p> : (state as { message?: string }).message ? <p className="portal-ok">{(state as { message?: string }).message}</p> : null}
      <button type="submit" className="portal-btn" disabled={pending}>{pending ? "جارٍ الإرسال..." : submit}</button>
    </form>
  );
}

export function ReplyBox({ ticketId }: { ticketId: string }) {
  return (
    <PortalForm action={portalReplyTicketAction.bind(null, ticketId)} submit="إرسال الرد" reset>
      <div className="field"><label htmlFor="body">ردك</label><textarea id="body" name="body" rows={4} required maxLength={20000} /></div>
    </PortalForm>
  );
}

export function MessageBox({ projectId }: { projectId: string }) {
  return (
    <PortalForm action={portalPostMessageAction.bind(null, projectId)} submit="إرسال" reset>
      <div className="field"><textarea name="body" rows={3} required maxLength={10000} placeholder="اكتب رسالتك للفريق..." aria-label="الرسالة" /></div>
    </PortalForm>
  );
}

export function SatisfactionForm({ projectId }: { projectId: string }) {
  const [score, setScore] = useState(9);
  return (
    <PortalForm action={portalSatisfactionAction.bind(null, projectId)} submit="إرسال التقييم">
      <div className="field">
        <label>ما مدى رضاك عن المشروع؟ ({score}/10)</label>
        <input type="range" name="score" min={1} max={10} value={score} onChange={(e) => setScore(Number(e.target.value))} />
      </div>
      <div className="field"><label htmlFor="comment">تعليق (اختياري)</label><textarea id="comment" name="comment" rows={2} /></div>
    </PortalForm>
  );
}
