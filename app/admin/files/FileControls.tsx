"use client";

import { Tx, Opt } from "@/components/bos/I18n";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionButton, ConfirmButton, ModalButton } from "@/components/bos/Dialog";
import { purgeFileAction, restoreFileAction, setTemplateAction, shareFileAction, shareFileWithRoleAction } from "@/app/admin/_actions/common";

type Opt = { value: string; label: string };

export function RestoreFileButton({ id }: { id: string }) {
  return <ActionButton label="استعادة" className="admin-btn small ghost" action={() => restoreFileAction(id)} />;
}
export function PurgeFileButton({ id }: { id: string }) {
  return <ConfirmButton label="حذف نهائي" className="admin-btn small danger" message="حذف الملف وكل إصداراته من التخزين نهائياً؟ لا يمكن التراجع." action={() => purgeFileAction(id)} />;
}
export function TemplateToggle({ id, isTemplate }: { id: string; isTemplate: boolean }) {
  return <ActionButton label={isTemplate ? "إزالة من القوالب" : "جعله قالباً"} className="admin-btn small ghost" action={() => setTemplateAction(id, !isTemplate)} />;
}
export function ShareButton({ id, users, roles }: { id: string; users: Opt[]; roles: Opt[] }) {
  const [kind, setKind] = useState("user");
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <ModalButton label="مشاركة" title="مشاركة الملف" className="admin-btn small ghost">
      {() => (
        <div>
          <div className="bos-row" style={{ gap: 6 }}>
            <select value={kind} onChange={(e) => { setKind(e.target.value); setValue(""); }}><Opt value="user">شخص</Opt><Opt value="role">دور</Opt></select>
            <select value={value} onChange={(e) => setValue(e.target.value)} style={{ flex: 1 }}><Opt value="">اختر...</Opt>{(kind === "user" ? users : roles).map((o) => <Opt key={o.value} value={o.value}>{o.label}</Opt>)}</select>
          </div>
          <div className="bos-form-actions"><button type="button" className="admin-btn" disabled={pending || !value} onClick={() => start(async () => { const r = kind === "user" ? await shareFileAction(id, value) : await shareFileWithRoleAction(id, value); setMsg(r.ok ? r.message ?? "تم" : r.error); router.refresh(); })}><Tx>مشاركة</Tx></button></div>
          {msg ? <div className="bos-faint"><Tx>{msg}</Tx></div> : null}
        </div>
      )}
    </ModalButton>
  );
}
