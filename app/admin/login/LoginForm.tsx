"use client";

import { Tx } from "@/components/bos/I18n";

import { useActionState, useState, useTransition } from "react";
import { signInAction, signInWithGoogleAction, type LoginState } from "../actions";

const initialState: LoginState = { error: null };

export function LoginForm({ googleEnabled, initialError }: { googleEnabled: boolean; initialError: string | null }) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const [googlePending, startGoogle] = useTransition();
  const [googleError, setGoogleError] = useState<string | null>(null);
  const error = state.error ?? googleError ?? initialError;

  return (
    <form action={formAction}>
      <div className="admin-field">
        <label htmlFor="email"><Tx>البريد الإلكتروني</Tx></label>
        <input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="admin-field">
        <label htmlFor="password"><Tx>كلمة المرور</Tx></label>
        <input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      {error ? <p className="admin-error"><Tx>{error}</Tx></p> : null}
      <button type="submit" className="admin-btn" disabled={pending} style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
        <Tx>{pending ? "جارِ الدخول..." : "تسجيل الدخول"}</Tx>
      </button>
      {googleEnabled ? (
        <button
          type="button"
          className="admin-btn secondary"
          disabled={googlePending}
          style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
          onClick={() => startGoogle(async () => setGoogleError((await signInWithGoogleAction()).error))}
        >
          <Tx>{googlePending ? "جارِ التحويل إلى Google..." : "الدخول عبر Google"}</Tx>
        </button>
      ) : null}
    </form>
  );
}
