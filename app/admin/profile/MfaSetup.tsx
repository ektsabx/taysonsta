"use client";

import { Tx } from "@/components/bos/I18n";
import { nowIso } from "@/lib/bos/clock";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { syncMyMfaAction } from "./actions";

// TOTP enrollment through Supabase Auth. The secret/QR is shown once in the
// browser and never sent to or stored by the BOS (IT §10).
const statusLabel: Record<string, string> = { enabled: "مفعّل", pending: "بانتظار التأكيد", required: "مطلوب — غير مفعّل", not_configured: "غير مفعّل", disabled: "معطّل", recovery_required: "يحتاج استعادة" };

export function MfaSetup({ status }: { status: string }) {
  const enabled = status === "enabled";
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  const enroll = () =>
    start(async () => {
      setMsg(null);
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.all ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `BOS ${nowIso().slice(0, 10)}` });
      if (error) return setMsg(error.message);
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    });
  const verify = () =>
    start(async () => {
      if (!factorId) return;
      const { data: ch, error: e1 } = await supabase.auth.mfa.challenge({ factorId });
      if (e1) return setMsg(e1.message);
      const { error: e2 } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() });
      if (e2) return setMsg("الرمز غير صحيح، حاول مرة أخرى.");
      setQr(null);
      setSecret(null);
      const r = await syncMyMfaAction();
      setMsg(r.ok ? r.message ?? "تم" : r.error);
      router.refresh();
    });
  const sync = () => start(async () => { const r = await syncMyMfaAction(); setMsg(r.ok ? r.message ?? "تم" : r.error); router.refresh(); });

  return (
    <div className="bos-stack" style={{ gap: 10 }}>
      <div className="bos-row" style={{ gap: 10, alignItems: "center" }}>
        <span className="bos-kv-label"><Tx>الحالة</Tx></span>
        <span className={`bos-badge tone-${enabled ? "success" : status === "pending" ? "warning" : "danger"}`} data-status={status}><Tx>{statusLabel[status] ?? status}</Tx></span>
      </div>
      <p style={{ fontSize: 13, margin: 0 }}><Tx>تطبيق المصادقة يضيف رمزاً من 6 أرقام يتغيّر كل 30 ثانية ويُطلب مع كلمة المرور عند الدخول، فلا يكفي تسريب كلمة المرور وحدها للوصول إلى حسابك.</Tx></p>
      {!enabled ? (
        <ol className="bos-steps-list">
          <li><Tx>ثبّت تطبيق مصادقة على هاتفك (Google Authenticator أو Microsoft Authenticator أو 1Password أو Authy).</Tx></li>
          <li><Tx>اضغط «تفعيل عبر تطبيق المصادقة» وامسح رمز QR بالتطبيق.</Tx></li>
          <li><Tx>أدخل الرمز المكوّن من 6 أرقام الظاهر في التطبيق ثم اضغط «تأكيد».</Tx></li>
        </ol>
      ) : <p className="bos-faint" style={{ fontSize: 12.5, margin: 0 }}><Tx>لإيقاف التحقق بخطوتين أو عند فقدان الهاتف تواصل مع مسؤول النظام لاستعادة الحساب.</Tx></p>}
      {!qr ? (
        <div className="bos-row" style={{ gap: 8 }}>
          {!enabled ? <button type="button" className="admin-btn small" disabled={pending} onClick={enroll}><Tx>تفعيل عبر تطبيق المصادقة</Tx></button> : null}
          <button type="button" className="admin-btn small ghost" disabled={pending} onClick={sync}><Tx>تحديث الحالة</Tx></button>
        </div>
      ) : (
        <div className="bos-stack" style={{ gap: 8 }}>
          <p style={{ fontSize: 13 }}><Tx>امسح الرمز بتطبيق المصادقة (Google Authenticator / 1Password / Authy) ثم أدخل الرمز المكوّن من 6 أرقام.</Tx></p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR" width={180} height={180} style={{ background: "#fff", borderRadius: 8, padding: 6 }} />
          <div className="bos-faint" style={{ fontSize: 12 }} dir="ltr"><Tx>{secret}</Tx></div>
          <div className="bos-row" style={{ gap: 6 }}>
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="123456" dir="ltr" style={{ width: 120 }} />
            <button type="button" className="admin-btn small" disabled={pending || code.length < 6} onClick={verify}><Tx>تأكيد</Tx></button>
          </div>
        </div>
      )}
      {msg ? <div className="bos-faint" style={{ fontSize: 12.5 }}><Tx>{msg}</Tx></div> : null}
    </div>
  );
}
