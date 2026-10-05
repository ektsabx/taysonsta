"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/client";

export function TwoFactorForm() {
  const { t } = useI18n();
  const a = t.auth;
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp.find((f) => f.status === "verified");
    if (!factor) {
      setPending(false);
      return setError(a.twoFactorFailed);
    }
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
    if (err) {
      setPending(false);
      return setError(a.twoFactorInvalid);
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <>
      <form className="auth-form" onSubmit={verify}>
        <div className="field">
          <label htmlFor="code">{a.twoFactorCode}</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} dir="ltr" className="form-input"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required autoFocus />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn-primary auth-submit" type="submit" disabled={pending || code.length !== 6}>
          {pending ? t.common.sending : a.twoFactorSubmit}
          {!pending && <ArrowRight className="flip-rtl" />}
        </button>
      </form>
      <p className="auth-alt"><a href="/auth/signout">{a.twoFactorSignOut}</a></p>
    </>
  );
}
