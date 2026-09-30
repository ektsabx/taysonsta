"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Landing page for portal invitations and password recovery links.
export default function PortalSetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // Invitation/recovery links carry the session in the URL hash or ?code=.
    const code = new URL(window.location.href).searchParams.get("code");
    (code ? supabase.auth.exchangeCodeForSession(code) : supabase.auth.getSession()).finally(() => setReady(true));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 10) return setError("كلمة المرور يجب أن تكون 10 أحرف على الأقل");
    if (password !== confirm) return setError("كلمتا المرور غير متطابقتين");
    setPending(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (err) return setError(err.message);
    router.push("/portal");
  }

  return (
    <div className="portal-login">
      <div className="portal-card">
        <h1 style={{ fontSize: 20, marginTop: 0 }}>تعيين كلمة المرور</h1>
        {!ready ? <p className="portal-muted">جارٍ التحقق من الرابط...</p> : (
          <form onSubmit={submit}>
            <div className="field"><label htmlFor="pw">كلمة المرور الجديدة</label><input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required /></div>
            <div className="field"><label htmlFor="pw2">تأكيد كلمة المرور</label><input id="pw2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required /></div>
            {error ? <p className="portal-error">{error}</p> : null}
            <button type="submit" className="portal-btn" disabled={pending} style={{ width: "100%", justifyContent: "center" }}>حفظ والدخول</button>
          </form>
        )}
      </div>
    </div>
  );
}
