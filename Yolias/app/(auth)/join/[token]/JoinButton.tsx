"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvitation, type JoinError } from "./actions";

export function JoinButton({ token, label, errors }: { token: string; label: string; errors: Record<JoinError, string> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className="btn-primary auth-submit" disabled={pending} onClick={() => start(async () => {
        const r = await acceptInvitation(token);
        if (r.ok) router.push("/dashboard");
        else setError(errors[r.error]);
      })}>{label}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}
