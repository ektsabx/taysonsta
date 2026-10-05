"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tx, useT } from "@/components/bos/I18n";
import type { ActionState } from "@/lib/bos/action";
import { assetAction } from "./asset-actions";

type O = { value: string; label: string };

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return { pending, msg, run: (fn: () => Promise<ActionState>, after?: () => void) => start(async () => { const r = await fn(); setMsg(r.ok ? { ok: true, text: r.message ?? "تم" } : { ok: false, text: r.error }); if (r.ok) after?.(); router.refresh(); }) };
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  const t = useT();
  return msg ? <span className={msg.ok ? "bos-faint" : "bos-danger"} style={{ fontSize: 12 }}>{t(msg.text)}</span> : null;
}

export function MarkAvailable({ id }: { id: string }) {
  const { pending, msg, run } = useRun();
  return <span><button type="button" className="admin-btn small secondary" disabled={pending} onClick={() => run(() => assetAction("available", id))}><Tx>تجهيز وإتاحة</Tx></button> <Msg msg={msg} /></span>;
}

export function SeatPanel({ id, employees, seats }: { id: string; employees: O[]; seats: { id: string; name: string; since: string }[] }) {
  const t = useT();
  const { pending, msg, run } = useRun();
  const [emp, setEmp] = useState("");
  return (
    <div className="bos-stack" style={{ gap: 6 }}>
      {seats.map((s) => <div key={s.id} className="bos-row" style={{ gap: 6, alignItems: "center", fontSize: 13 }}><span style={{ flex: 1 }}>{s.name}</span><span className="bos-faint">{s.since}</span><button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => run(() => assetAction("release", s.id))}><Tx>تحرير</Tx></button></div>)}
      <div className="bos-row" style={{ gap: 6 }}>
        <select value={emp} onChange={(e) => setEmp(e.target.value)} className="bos-select-small" aria-label={t("الموظف")}><option value="">{t("تعيين مقعد لـ…")}</option>{employees.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}</select>
        <button type="button" className="admin-btn small" disabled={pending || !emp} onClick={() => run(() => assetAction("seat", id, emp), () => setEmp(""))}><Tx>تعيين</Tx></button>
      </div>
      <Msg msg={msg} />
    </div>
  );
}

export function StockPanel({ id, quantity, min, employees }: { id: string; quantity: number; min: number | null; employees: O[] }) {
  const t = useT();
  const { pending, msg, run } = useRun();
  const [qty, setQty] = useState("1");
  const [dir, setDir] = useState<"in" | "out">("out");
  const [reason, setReason] = useState("");
  const [emp, setEmp] = useState("");
  return (
    <div className="bos-stack" style={{ gap: 6 }}>
      <div><Tx>الرصيد الحالي</Tx>: <b className={min != null && quantity < min ? "bos-danger" : ""}>{quantity}</b>{min != null ? <span className="bos-faint"> · <Tx>الحد الأدنى</Tx> {min}</span> : null}</div>
      <div className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
        <select value={dir} onChange={(e) => setDir(e.target.value as "in")} className="bos-select-small" aria-label={t("الحركة")}><option value="out">{t("صرف")}</option><option value="in">{t("إضافة للمخزون")}</option></select>
        <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} style={{ width: 80 }} aria-label={t("الكمية")} />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("السبب")} style={{ minWidth: 160 }} />
        {dir === "out" ? <select value={emp} onChange={(e) => setEmp(e.target.value)} className="bos-select-small" aria-label={t("صُرف لـ")}><option value="">{t("صُرف لـ (اختياري)")}</option>{employees.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}</select> : null}
        <button type="button" className="admin-btn small" disabled={pending || !reason.trim() || !(Number(qty) > 0)} onClick={() => run(() => assetAction("stock", id, String(dir === "out" ? -Number(qty) : Number(qty)), reason, emp || undefined), () => setReason(""))}><Tx>تسجيل</Tx></button>
      </div>
      <Msg msg={msg} />
    </div>
  );
}

export function MaintenancePanel({ id, open, vendors }: { id: string; open: { id: string; description: string } | null; vendors: O[] }) {
  const t = useT();
  const { pending, msg, run } = useRun();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [c, setC] = useState("");
  const [retire, setRetire] = useState(false);
  return open ? (
    <div className="bos-stack" style={{ gap: 6 }}>
      <div style={{ fontSize: 13 }}><Tx>مفتوح</Tx>: {open.description}</div>
      <div className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
        <input value={a} onChange={(e) => setA(e.target.value)} placeholder={t("النتيجة")} style={{ minWidth: 180 }} />
        <input type="number" min={0} step="0.01" value={b} onChange={(e) => setB(e.target.value)} placeholder={t("التكلفة")} style={{ width: 100 }} />
        <label className="bos-check"><input type="checkbox" checked={retire} onChange={(e) => setRetire(e.target.checked)} /> <Tx>غير قابل للإصلاح — استبعاد</Tx></label>
        <button type="button" className="admin-btn small" disabled={pending} onClick={() => run(() => assetAction("maint_close", open.id, a, b, retire ? "1" : "0"))}><Tx>إغلاق الصيانة</Tx></button>
      </div>
      <Msg msg={msg} />
    </div>
  ) : (
    <div className="bos-stack" style={{ gap: 6 }}>
      <div className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
        <input value={a} onChange={(e) => setA(e.target.value)} placeholder={t("وصف العطل")} style={{ minWidth: 200 }} />
        {vendors.length ? <select value={b} onChange={(e) => setB(e.target.value)} className="bos-select-small" aria-label={t("المورد")}><option value="">{t("المورد (اختياري)")}</option>{vendors.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}</select> : null}
        <input type="number" min={0} step="0.01" value={c} onChange={(e) => setC(e.target.value)} placeholder={t("التكلفة المتوقعة")} style={{ width: 120 }} />
        <button type="button" className="admin-btn small secondary" disabled={pending || !a.trim()} onClick={() => run(() => assetAction("maint_open", id, a, b, c), () => setA(""))}><Tx>إرسال للصيانة</Tx></button>
      </div>
      <Msg msg={msg} />
    </div>
  );
}

export function EndOfLife({ id }: { id: string }) {
  const t = useT();
  const { pending, msg, run } = useRun();
  const [reason, setReason] = useState("");
  return (
    <div className="bos-stack" style={{ gap: 6 }}>
      <div className="bos-row" style={{ gap: 6 }}>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("السبب")} style={{ minWidth: 160 }} />
        <button type="button" className="admin-btn small ghost" disabled={pending || !reason.trim()} onClick={() => { if (window.confirm(t("استبعاد الأصل؟"))) run(() => assetAction("retire", id, reason)); }}><Tx>استبعاد</Tx></button>
        <button type="button" className="admin-btn small ghost" disabled={pending || !reason.trim()} onClick={() => { if (window.confirm(t("تسجيل الأصل كمفقود؟"))) run(() => assetAction("lost", id, reason)); }}><Tx>مفقود</Tx></button>
      </div>
      <Msg msg={msg} />
    </div>
  );
}
