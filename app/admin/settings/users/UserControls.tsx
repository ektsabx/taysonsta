"use client";
import { BosTable } from "@/components/bos/BosTable";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tx, Opt, useT } from "@/components/bos/I18n";
import { ConfirmButton } from "@/components/bos/Dialog";
import { invitationAction, removePageRuleAction, savePageRuleAction, sendPasswordResetAction } from "./actions";

type O = { value: string; label: string };

// Resend / revoke a pending invitation (docs/bos/30 §6).
export function InvitationActions({ id, email }: { id: string; email: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span className="bos-row" style={{ gap: 6 }}>
      <button type="button" className="admin-btn small secondary" disabled={pending} onClick={() => start(async () => {
        const r = await invitationAction(id, "resend");
        setMsg(r.ok ? { ok: true, text: r.message ?? "" } : { ok: false, text: r.error });
        router.refresh();
      })}><Tx>{pending ? "جارِ الإرسال..." : "إعادة الإرسال"}</Tx></button>
      <ConfirmButton
        label="إلغاء الدعوة"
        className="admin-btn small danger"
        title="إلغاء الدعوة"
        message={t("سيُحذف حساب الدخول غير المستخدم لـ {email} ويبقى ملف الموظف. يمكن إنشاء دعوة جديدة لاحقاً.", { email })}
        confirmLabel="إلغاء الدعوة"
        action={() => invitationAction(id, "revoke")}
      />
      {msg ? <span className={msg.ok ? "bos-success" : "bos-field-error"} style={{ fontSize: 12 }}><Tx>{msg.text}</Tx></span> : null}
    </span>
  );
}

// Page-level restrictions editor (Settings → Security).
export function PageRulesEditor({ rules, roles }: { rules: { prefix: string; role_keys: string[]; note: string }[]; roles: O[] }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [prefix, setPrefix] = useState("/admin/");
  const [keys, setKeys] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const roleName = (k: string) => roles.find((r) => r.value === k)?.label ?? k;
  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) => start(async () => {
    const r = await fn();
    setMsg(r.ok ? { ok: true, text: r.message ?? "" } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  });
  return (
    <div className="bos-stack">
      {rules.length ? (
        <BosTable className="bos-table">
          <thead><tr><th><Tx>مسار الصفحة</Tx></th><th><Tx>الأدوار المسموحة</Tx></th><th><Tx>ملاحظة</Tx></th><th /></tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.prefix}>
                <td dir="ltr">{r.prefix}</td>
                <td>{r.role_keys.map((k) => t(roleName(k))).join("، ")}</td>
                <td>{r.note || "—"}</td>
                <td><button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => run(() => removePageRuleAction(r.prefix))}><Tx>حذف</Tx></button></td>
              </tr>
            ))}
          </tbody>
        </BosTable>
      ) : <div className="bos-faint" style={{ fontSize: 12.5 }}><Tx>لا توجد قيود — صلاحيات الوحدات وحدها تحدد الوصول.</Tx></div>}
      <div className="bos-form-grid">
        <div className="bos-field"><label><Tx>مسار الصفحة</Tx></label><input dir="ltr" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="/admin/finance/revenue" /></div>
        <div className="bos-field"><label><Tx>الأدوار المسموحة</Tx></label>
          <select multiple value={keys} onChange={(e) => setKeys(Array.from(e.target.selectedOptions).map((o) => o.value))} style={{ minHeight: 90 }}>
            {roles.map((r) => <Opt key={r.value} value={r.value}>{r.label}</Opt>)}
          </select>
        </div>
        <div className="bos-field"><label><Tx>ملاحظة</Tx></label><input value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
      <div className="bos-row" style={{ gap: 8 }}>
        <button type="button" className="admin-btn small" disabled={pending} onClick={() => run(() => savePageRuleAction({ prefix, role_keys: keys, note }))}><Tx>حفظ القيد</Tx></button>
        {msg ? <span className={msg.ok ? "bos-success" : "bos-field-error"} style={{ fontSize: 12 }}><Tx>{msg.text}</Tx></span> : null}
      </div>
    </div>
  );
}

export function PasswordResetButton({ employeeId }: { employeeId: string }) {
  return <ConfirmButton label="رابط كلمة المرور" title="إعادة تعيين كلمة المرور" message="سيُرسل رابط آمن إلى بريد المستخدم لتعيين كلمة مرور جديدة. لا يرى أحد كلمة المرور." confirmLabel="إرسال" className="admin-btn small ghost" action={() => sendPasswordResetAction(employeeId)} />;
}
