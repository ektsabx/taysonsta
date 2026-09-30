"use client";

import Link from "next/link";
import { useActionState } from "react";
import { portalSignInAction, type PortalLoginState } from "../actions";

export function PortalLoginForm() {
  const [state, action, pending] = useActionState<PortalLoginState, FormData>(portalSignInAction, { error: null });
  return (
    <form action={action}>
      <div className="field"><label htmlFor="email">البريد الإلكتروني</label><input id="email" name="email" type="email" required autoComplete="email" dir="ltr" /></div>
      <div className="field"><label htmlFor="password">كلمة المرور</label><input id="password" name="password" type="password" required autoComplete="current-password" /></div>
      {state.error ? <p className="portal-error">{state.error}</p> : null}
      <button type="submit" className="portal-btn" disabled={pending} style={{ width: "100%", justifyContent: "center" }}>{pending ? "جارٍ الدخول..." : "تسجيل الدخول"}</button>
      <p className="portal-muted" style={{ marginTop: 12, textAlign: "center" }}><Link href="/portal/forgot">نسيت كلمة المرور؟</Link></p>
    </form>
  );
}
