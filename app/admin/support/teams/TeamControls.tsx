"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tx, Opt } from "@/components/bos/I18n";
import { ModalButton } from "@/components/bos/Dialog";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextField } from "@/components/bos/Form";
import { saveTeamAction, teamMemberAction } from "../inbox/actions";

type O = { value: string; label: string };

export function TeamButton({ team }: { team?: { id: string; name: string; description: string | null; assignment: string; is_active: boolean } }) {
  return (
    <ModalButton label={team ? "تعديل" : "+ فريق"} title={team ? "تعديل الفريق" : "فريق دعم جديد"} className={team ? "admin-btn small ghost" : "admin-btn small"}>
      {(close) => (
        <ActionForm action={saveTeamAction} onSuccess={close} successMessage="تم الحفظ">
          {team ? <input type="hidden" name="id" value={team.id} /> : null}
          <div className="bos-form-grid">
            <TextField name="name" label="الاسم" defaultValue={team?.name ?? ""} required />
            <SelectField name="assignment" label="قاعدة التوزيع" defaultValue={team?.assignment ?? "least_busy"} options={[{ value: "least_busy", label: "الأقل انشغالاً" }, { value: "round_robin", label: "دوري" }, { value: "manual", label: "يدوي" }]} />
            <TextField name="description" label="الوصف" defaultValue={team?.description ?? ""} span="all" />
            <CheckboxField name="is_active" label="مفعّل" defaultChecked={team?.is_active ?? true} />
          </div>
          <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function TeamMemberAdd({ teamId, staff }: { teamId: string; staff: O[] }) {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [max, setMax] = useState("20");
  const [pending, start] = useTransition();
  if (!staff.length) return null;
  return (
    <div className="bos-row" style={{ gap: 6, alignItems: "flex-end" }}>
      <div className="bos-field"><label><Tx>إضافة وكيل</Tx></label><select value={user} onChange={(e) => setUser(e.target.value)}><option value="">—</option>{staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
      <div className="bos-field" style={{ width: 110 }}><label><Tx>السعة</Tx></label><input type="number" min={1} max={500} value={max} onChange={(e) => setMax(e.target.value)} /></div>
      <button type="button" className="admin-btn small secondary" disabled={pending || !user} onClick={() => start(async () => { await teamMemberAction(teamId, user, "add", Number(max) || 20); setUser(""); router.refresh(); })}><Tx>إضافة</Tx></button>
    </div>
  );
}

export function TeamMemberControls({ teamId, userId, role, available }: { teamId: string; userId: string; role: string; available: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (op: "remove" | "lead" | "agent" | "available" | "away") => start(async () => { await teamMemberAction(teamId, userId, op); router.refresh(); });
  return (
    <div className="bos-row" style={{ gap: 4, justifyContent: "flex-end" }}>
      <select className="bos-select-small" value="" disabled={pending} onChange={(e) => e.target.value && run(e.target.value as "remove")}>
        <option value="">…</option>
        <Opt value={role === "lead" ? "agent" : "lead"}>{role === "lead" ? "تحويل لوكيل" : "تعيين كقائد"}</Opt>
        <Opt value={available ? "away" : "available"}>{available ? "تعليم كغير متاح" : "تعليم كمتاح"}</Opt>
        <Opt value="remove">إزالة من الفريق</Opt>
      </select>
    </div>
  );
}
