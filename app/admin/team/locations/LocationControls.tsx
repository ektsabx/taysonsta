"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tx, useT } from "@/components/bos/I18n";
import type { ActionState } from "@/lib/bos/action";
import { consentAction, deleteMyLocationsAction, locationSettingsAction } from "./actions";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return { pending, msg, run: (fn: () => Promise<ActionState>) => start(async () => { const r = await fn(); setMsg(r.ok ? { ok: true, text: r.message ?? "تم" } : { ok: false, text: r.error }); router.refresh(); }) };
}
function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  const t = useT();
  return msg ? <span className={msg.ok ? "bos-faint" : "bos-danger"} style={{ fontSize: 12 }}>{t(msg.text)}</span> : null;
}

export function ConsentCard({ consented, allowTasks, scope }: { consented: boolean; allowTasks: boolean; scope: string | null }) {
  const { pending, msg, run } = useRun();
  const [tasks, setTasks] = useState(scope === "attendance_tasks");
  return (
    <div className="bos-stack" style={{ gap: 8 }}>
      {allowTasks ? <label className="bos-check"><input type="checkbox" checked={tasks} onChange={(e) => setTasks(e.target.checked)} disabled={pending} /> <Tx>أيضاً عند تسجيل الوصول إلى مهمة ميدانية</Tx></label> : null}
      <div className="bos-row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {consented ? (
          <button type="button" className="admin-btn secondary" disabled={pending} onClick={() => run(() => consentAction(false, "attendance"))}><Tx>سحب الموافقة</Tx></button>
        ) : (
          <button type="button" className="admin-btn" disabled={pending} onClick={() => run(() => consentAction(true, tasks ? "attendance_tasks" : "attendance"))}><Tx>أوافق على مشاركة موقعي عند هذه الأحداث فقط</Tx></button>
        )}
        {consented && allowTasks ? <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => run(() => consentAction(true, tasks ? "attendance_tasks" : "attendance"))}><Tx>تحديث النطاق</Tx></button> : null}
        <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => { if (window.confirm("حذف كل سجل مواقعك؟")) run(() => deleteMyLocationsAction()); }}><Tx>حذف سجل مواقعي</Tx></button>
        <Msg msg={msg} />
      </div>
    </div>
  );
}

export function LocationSettings({ initial }: { initial: { enabled: boolean; purpose_text: string; retention_days: number; allow_task_checkins: boolean } }) {
  const t = useT();
  const { pending, msg, run } = useRun();
  const [v, setV] = useState(initial);
  return (
    <div className="bos-stack" style={{ gap: 8 }}>
      <label className="bos-check"><input type="checkbox" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} /> <Tx>تفعيل مشاركة الموقع (بموافقة كل موظف)</Tx></label>
      <label className="bos-check"><input type="checkbox" checked={v.allow_task_checkins} onChange={(e) => setV({ ...v, allow_task_checkins: e.target.checked })} /> <Tx>السماح بتسجيل الوصول للمهام الميدانية</Tx></label>
      <div className="bos-field"><label><Tx>غرض الجمع (يظهر للموظف قبل الموافقة)</Tx></label><textarea rows={3} value={v.purpose_text} onChange={(e) => setV({ ...v, purpose_text: e.target.value })} maxLength={2000} /></div>
      <div className="bos-field" style={{ maxWidth: 240 }}><label><Tx>مدة الاحتفاظ (أيام)</Tx></label><input type="number" min={7} max={730} value={v.retention_days} onChange={(e) => setV({ ...v, retention_days: Number(e.target.value) })} /></div>
      <div className="bos-row" style={{ gap: 6, alignItems: "center" }}><button type="button" className="admin-btn" disabled={pending} onClick={() => run(() => locationSettingsAction(v))}>{t("حفظ")}</button><Msg msg={msg} /></div>
    </div>
  );
}
