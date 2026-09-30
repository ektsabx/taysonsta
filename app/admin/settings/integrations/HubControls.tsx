"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tx, useT } from "@/components/bos/I18n";
import { ModalButton, ConfirmButton } from "@/components/bos/Dialog";
import { ActionForm, TextField, SubmitButton } from "@/components/bos/Form";
import type { ProviderDef } from "@/lib/bos/integrations/catalog";
import { aiPingAction, connectionOpAction, saveConnectionAction } from "./actions";

export interface ConnView {
  id: string;
  label: string;
  status: string;
  is_default: boolean;
  config: Record<string, string>;
  secret_hint: Record<string, string>;
}

// Add / edit a connection. Secret inputs are write-only: the stored value is
// never sent to the browser; leaving the field empty keeps it.
export function ConnectionButton({ def, conn }: { def: ProviderDef; conn?: ConnView }) {
  const t = useT();
  return (
    <ModalButton label={conn ? "تعديل" : "+ حساب"} title={`${def.name} — ${conn ? t("تعديل الحساب") : t("حساب جديد")}`} className={conn ? "admin-btn small ghost" : "admin-btn small"}>
      {(close) => (
        <ActionForm action={saveConnectionAction} onSuccess={close} successMessage="تم الحفظ">
          <input type="hidden" name="provider" value={def.key} />
          {conn ? <input type="hidden" name="id" value={conn.id} /> : null}
          <div className="bos-form-grid">
            <TextField name="label" label="اسم الحساب" required defaultValue={conn?.label ?? def.name} maxLength={120} />
            {def.fields.map((f) =>
              f.secret ? (
                <TextField
                  key={f.key}
                  name={`f_${f.key}`}
                  label={f.label}
                  type="password"
                  autoComplete="new-password"
                  dir="ltr"
                  required={f.required && !conn?.secret_hint[f.key]}
                  placeholder={conn?.secret_hint[f.key] ? t("محفوظ {hint} — اتركه فارغاً للإبقاء", { hint: conn.secret_hint[f.key] }) : f.placeholder}
                  hint={f.hint}
                />
              ) : (
                <TextField key={f.key} name={`f_${f.key}`} label={f.label} dir="ltr" required={f.required} defaultValue={conn?.config[f.key] ?? ""} placeholder={f.placeholder} hint={f.hint} />
              ),
            )}
          </div>
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>بيانات الاعتماد تُشفّر على الخادم (AES-256-GCM) ولا تُعرض مرة أخرى.</Tx></p>
          <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function ConnectionActions({ conn, testable }: { conn: ConnView; testable: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (op: "test" | "default" | "enable" | "disable") => start(async () => {
    const r = await connectionOpAction(conn.id, op);
    setMsg(r.ok ? { ok: true, text: r.message ?? "" } : { ok: false, text: r.error });
    router.refresh();
  });
  return (
    <div className="bos-stack" style={{ gap: 4 }}>
      <div className="bos-row" style={{ gap: 4 }}>
        {testable ? <button type="button" className="admin-btn small secondary" disabled={pending} onClick={() => run("test")}><Tx>{pending ? "..." : "اختبار الاتصال"}</Tx></button> : null}
        {!conn.is_default && conn.status !== "disabled" ? <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => run("default")}><Tx>تعيين كافتراضي</Tx></button> : null}
        <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => run(conn.status === "disabled" ? "enable" : "disable")}><Tx>{conn.status === "disabled" ? "تفعيل" : "تعطيل"}</Tx></button>
        <ConfirmButton label="حذف" className="admin-btn small danger" title="حذف الحساب" message="سيُحذف الحساب وبيانات اعتماده المشفّرة نهائياً. السجلات السابقة تبقى." confirmLabel="حذف" action={() => connectionOpAction(conn.id, "delete")} />
      </div>
      {msg ? <span className={msg.ok ? "bos-success" : "bos-field-error"} style={{ fontSize: 12 }}><Tx>{msg.text}</Tx></span> : null}
    </div>
  );
}

export function AiPingButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span className="bos-row" style={{ gap: 8 }}>
      <button type="button" className="admin-btn small secondary" disabled={pending} onClick={() => start(async () => {
        const r = await aiPingAction();
        setMsg(r.ok ? { ok: true, text: r.message ?? "" } : { ok: false, text: r.error });
        router.refresh();
      })}><Tx>{pending ? "جارٍ التجربة..." : "تجربة الذكاء الاصطناعي"}</Tx></button>
      {msg ? <span className={msg.ok ? "bos-success" : "bos-field-error"} style={{ fontSize: 12 }}><Tx>{msg.text}</Tx></span> : null}
    </span>
  );
}
