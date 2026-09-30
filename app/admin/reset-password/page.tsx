"use client";

import { Tx } from "@/components/bos/I18n";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }

    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/admin/dashboard"), 1500);
  }

  return (
    <div className="admin-login-shell">
      <div className="admin-login-card">
        <h1><Tx>تعيين كلمة مرور جديدة</Tx></h1>
        {done ? (
          <p className="admin-success"><Tx>تم تعيين كلمة المرور بنجاح، جارِ التحويل...</Tx></p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="admin-field">
              <label htmlFor="password"><Tx>كلمة المرور الجديدة</Tx></label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="confirmPassword"><Tx>تأكيد كلمة المرور</Tx></label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            {error ? <p className="admin-error"><Tx>{error}</Tx></p> : null}
            <button type="submit" className="admin-btn" disabled={pending} style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
              <Tx>{pending ? "جارِ الحفظ..." : "حفظ كلمة المرور"}</Tx>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
