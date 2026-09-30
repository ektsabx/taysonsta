"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tx, useT } from "@/components/bos/I18n";
import type { ActionState } from "@/lib/bos/action";
import { explainDealAction, radarAction } from "./actions";

type O = { value: string; label: string };

export function RadarActions({ dealId, nextId, staff, canAssign, canUpdate, aiReady }: { dealId: string; nextId: string | null; staff: O[]; canAssign: boolean; canUpdate: boolean; aiReady: boolean }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState<null | "followup" | "reschedule" | "assign" | "nudge" | "risk" | "ai">(null);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [c, setC] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ai, setAi] = useState<{ summary: string; signals_used: string[]; next_steps: string[]; caveats: string[] } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionState>) => start(async () => { const r = await fn(); setMsg(r.ok ? { ok: true, text: r.message ?? "تم" } : { ok: false, text: r.error }); if (r.ok) { setOpen(null); setA(""); setB(""); setC(""); } router.refresh(); });
  const btn = (k: typeof open, label: string) => <button type="button" className={`admin-btn small ${open === k ? "" : "ghost"}`} onClick={() => { setOpen(open === k ? null : k); setMsg(null); }}>{t(label)}</button>;
  return (
    <div className="bos-stack" style={{ gap: 6 }}>
      <div className="bos-row" style={{ gap: 4, flexWrap: "wrap" }}>
        {btn("followup", "+ متابعة / مهمة")}
        {nextId ? btn("reschedule", "تغيير موعد المتابعة") : null}
        {canAssign ? btn("assign", "تعيين مسؤول") : null}
        {btn("nudge", "تنبيه المسؤول")}
        {canUpdate ? btn("risk", "+ خطر / عائق") : null}
        {aiReady ? btn("ai", "تحليل بالذكاء الاصطناعي") : null}
      </div>
      {open === "followup" ? (
        <div className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
          <select value={a} onChange={(e) => setA(e.target.value)} className="bos-select-small" aria-label={t("النوع")}><option value="follow_up">{t("متابعة")}</option><option value="call">{t("مكالمة")}</option><option value="meeting">{t("اجتماع")}</option><option value="task">{t("مهمة")}</option></select>
          <input value={b} onChange={(e) => setB(e.target.value)} placeholder={t("العنوان")} style={{ minWidth: 180 }} />
          <input type="datetime-local" value={c} onChange={(e) => setC(e.target.value)} aria-label={t("الموعد")} />
          <button type="button" className="admin-btn small" disabled={pending || !b || !c} onClick={() => run(() => radarAction("followup", dealId, a || "follow_up", b, new Date(c).toISOString()))}><Tx>حفظ</Tx></button>
        </div>
      ) : null}
      {open === "reschedule" && nextId ? (
        <div className="bos-row" style={{ gap: 6 }}>
          <input type="datetime-local" value={a} onChange={(e) => setA(e.target.value)} aria-label={t("الموعد الجديد")} />
          <button type="button" className="admin-btn small" disabled={pending || !a} onClick={() => run(() => radarAction("reschedule", nextId, new Date(a).toISOString()))}><Tx>حفظ</Tx></button>
        </div>
      ) : null}
      {open === "assign" ? (
        <div className="bos-row" style={{ gap: 6 }}>
          <select value={a} onChange={(e) => setA(e.target.value)} className="bos-select-small" aria-label={t("المسؤول")}><option value="">—</option>{staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
          <button type="button" className="admin-btn small" disabled={pending || !a} onClick={() => run(() => radarAction("assign", dealId, a))}><Tx>حفظ</Tx></button>
        </div>
      ) : null}
      {open === "nudge" ? (
        <div className="bos-row" style={{ gap: 6 }}>
          <input value={a} onChange={(e) => setA(e.target.value)} placeholder={t("رسالة للمسؤول")} style={{ flex: 1, minWidth: 220 }} maxLength={500} />
          <button type="button" className="admin-btn small" disabled={pending || !a.trim()} onClick={() => run(() => radarAction("nudge", dealId, a))}><Tx>إرسال</Tx></button>
        </div>
      ) : null}
      {open === "risk" ? (
        <div className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
          <select value={a} onChange={(e) => setA(e.target.value)} className="bos-select-small" aria-label={t("النوع")}><option value="risk">{t("خطر")}</option><option value="blocker">{t("عائق")}</option><option value="delay_reason">{t("سبب تأخير")}</option></select>
          <input value={b} onChange={(e) => setB(e.target.value)} placeholder={t("الوصف")} style={{ flex: 1, minWidth: 220 }} maxLength={1000} />
          <button type="button" className="admin-btn small" disabled={pending || b.trim().length < 2} onClick={() => run(() => radarAction("risk", dealId, a || "risk", b))}><Tx>حفظ</Tx></button>
        </div>
      ) : null}
      {open === "ai" ? (
        <div className="bos-stack" style={{ gap: 6 }}>
          <button type="button" className="admin-btn small secondary" disabled={pending} onClick={() => start(async () => { setMsg(null); const r = await explainDealAction(dealId, "ar"); if (r.ok) setAi(r.data); else setMsg({ ok: false, text: r.error }); })}>{pending ? t("جارٍ التحليل…") : t("حلّل هذه الصفقة")}</button>
          {ai ? (
            <div style={{ fontSize: 12.5, border: "1px solid var(--bos-border)", borderRadius: 8, padding: 8 }}>
              <p style={{ margin: "0 0 6px" }}>{ai.summary}</p>
              <div><b><Tx>الإشارات المستخدمة:</Tx></b> {ai.signals_used.join(" · ")}</div>
              <div><b><Tx>الخطوات المقترحة:</Tx></b><ul style={{ margin: 0, paddingInlineStart: 18 }}>{ai.next_steps.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
              <div className="bos-faint">{ai.caveats.map((s) => t(s)).join(" · ")}</div>
            </div>
          ) : null}
        </div>
      ) : null}
      {msg ? <span className={msg.ok ? "bos-faint" : "bos-danger"} style={{ fontSize: 12 }}>{t(msg.text)}</span> : null}
    </div>
  );
}

export function ResolveRisk({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => start(async () => { await radarAction("resolve", id); router.refresh(); })} aria-label="تم الحل">✓</button>;
}
