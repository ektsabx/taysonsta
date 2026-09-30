"use client";

import { Tx, useT } from "@/components/bos/I18n";

import { useState } from "react";
import { ActionButton, ConfirmButton, ModalButton } from "@/components/bos/Dialog";
import { ActionForm, CheckboxField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { addMembersAction, createChannelAction, leaveChannelAction, startDirectAction } from "./actions";

type Opt = { value: string; label: string };

function MemberPicker({ people, name = "members[]" }: { people: Opt[]; name?: string }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <div className="bos-field">
      <label><Tx>الأعضاء</Tx></label>
      <input placeholder={t("بحث...")} value={q} onChange={(e) => setQ(e.target.value)} />
      <div style={{ maxHeight: 180, overflowY: "auto", marginTop: 6 }}>
        {people.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())).map((p) => (
          <label key={p.value} className="bos-check" style={{ display: "flex" }}>
            <input type="checkbox" name={name} value={p.value} checked={picked.includes(p.value)} onChange={(e) => setPicked(e.target.checked ? [...picked, p.value] : picked.filter((x) => x !== p.value))} />
            <Tx>{p.label}</Tx>
          </label>
        ))}
      </div>
    </div>
  );
}

export function NewDirectButton({ people }: { people: Opt[] }) {
  const t = useT();
  const [q, setQ] = useState("");
  return (
    <ModalButton label="+ رسالة مباشرة" title="رسالة مباشرة" className="admin-btn small secondary">
      {() => (
        <div className="bos-stack" style={{ gap: 6 }}>
          <input placeholder={t("ابحث عن زميل...")} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {people.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())).map((p) => (
              <ActionButton key={p.value} label={p.label} className="admin-btn small ghost" action={() => startDirectAction(p.value)} />
            ))}
          </div>
        </div>
      )}
    </ModalButton>
  );
}

export function NewChannelButton({ people }: { people: Opt[] }) {
  return (
    <ModalButton label="+ قناة" title="قناة فريق جديدة" className="admin-btn small">
      {() => (
        <ActionForm action={createChannelAction}>
          <TextField name="name" label="اسم القناة" required maxLength={80} />
          <TextAreaField name="description" label="الوصف" rows={2} />
          <CheckboxField name="is_private" label="قناة خاصة (للأعضاء فقط)" />
          <MemberPicker people={people} />
          <div className="bos-form-actions"><SubmitButton label="إنشاء" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function AddMembersButton({ channelId, people }: { channelId: string; people: Opt[] }) {
  return (
    <ModalButton label="+ أعضاء" title="إضافة أعضاء" className="admin-btn small ghost">
      {(close) => (
        <ActionForm action={addMembersAction.bind(null, channelId)} onSuccess={close}>
          <MemberPicker people={people} />
          <div className="bos-form-actions"><SubmitButton label="إضافة" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function LeaveChannelButton({ channelId }: { channelId: string }) {
  return <ConfirmButton label="مغادرة" className="admin-btn small ghost" message="مغادرة القناة؟ ستبقى الرسائل السابقة." action={() => leaveChannelAction(channelId)} />;
}

export function DiscussButton({ action, label = "مناقشة داخلية" }: { action: () => Promise<{ ok: boolean }>; label?: string }) {
  return <ActionButton label={label} className="admin-btn small secondary" action={action as never} />;
}
