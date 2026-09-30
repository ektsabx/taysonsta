"use client";

import Link from "next/link";
import { useActionState } from "react";
import { portalForgotAction, type PortalLoginState } from "../actions";

export default function PortalForgotPage() {
  const [state, action, pending] = useActionState<PortalLoginState & { sent?: boolean }, FormData>(async (prev, fd) => ({ ...(await portalForgotAction(prev, fd)), sent: true }), { error: null });
  return (
    <div className="portal-login">
      <div className="portal-card">
        <h1 style={{ fontSize: 20, marginTop: 0 }}>استعادة كلمة المرور</h1>
        {state.sent && !state.error ? (
          <p className="portal-ok">إذا كان البريد مسجلاً في البوابة، ستصلك رسالة بها رابط تعيين كلمة المرور.</p>
        ) : (
          <form action={action}>
            <div className="field"><label htmlFor="email">البريد الإلكتروني</label><input id="email" name="email" type="email" required dir="ltr" /></div>
            {state.error ? <p className="portal-error">{state.error}</p> : null}
            <button type="submit" className="portal-btn" disabled={pending} style={{ width: "100%", justifyContent: "center" }}>إرسال الرابط</button>
          </form>
        )}
        <p className="portal-muted" style={{ marginTop: 12, textAlign: "center" }}><Link href="/portal/login">العودة لتسجيل الدخول</Link></p>
      </div>
    </div>
  );
}
