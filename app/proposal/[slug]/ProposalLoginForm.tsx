"use client";

import { useActionState } from "react";
import { signInProposalAction, type ProposalLoginState } from "./actions";

const initialState: ProposalLoginState = { error: null };

export function ProposalLoginForm({ slug }: { slug: string }) {
  const boundAction = signInProposalAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction}>
      <div className="proposal-login-field">
        <label htmlFor="email">البريد الإلكتروني</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="proposal-login-field">
        <label htmlFor="password">كلمة المرور</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      {state.error ? <p className="proposal-login-error">{state.error}</p> : null}
      <button type="submit" className="proposal-login-submit" disabled={pending}>
        {pending ? "جارِ الدخول..." : "عرض المقترح"}
      </button>
    </form>
  );
}
