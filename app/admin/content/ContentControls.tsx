"use client";
import { BosTable } from "@/components/bos/BosTable";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tx, useT } from "@/components/bos/I18n";
import { ActionForm, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import type { ActionState } from "@/lib/bos/action";
import { draftAction, generateAction, removeStageAction, saveItemAction, saveStagesAction, stageAction, taskAction } from "./actions";
import { kindLabels, platformOptions, priorityLabels, typeLabels } from "./labels";

type O = { value: string; label: string };

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<ActionState>) => start(async () => { const r = await fn(); setMsg(r.ok ? { ok: true, text: r.message ?? "تم" } : { ok: false, text: r.error }); router.refresh(); });
  return { pending, msg, run };
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  const t = useT();
  return msg ? <span className={msg.ok ? "bos-faint" : "bos-danger"} style={{ fontSize: 12 }}>{t(msg.text)}</span> : null;
}

export interface ItemValues {
  id?: string; title?: string; description?: string | null; goal?: string | null; audience?: string | null; platforms?: string[]; content_type?: string; hook?: string | null; key_message?: string | null;
  cta?: string | null; topic?: string | null; tags?: string[]; priority?: string; owner_id?: string | null; deadline?: string | null; publish_date?: string | null; script?: string | null; final_version?: string | null;
  video_length_sec?: number | null; notes?: string | null; published_links?: string[];
}

const toLocal = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export function ItemForm({ initial = {}, staff, canAssign }: { initial?: ItemValues; staff: O[]; canAssign: boolean }) {
  return (
    <ActionForm action={saveItemAction} successMessage="تم الحفظ">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormSection title="الفكرة">
        <div className="bos-form-grid">
          <TextField name="title" label="العنوان" defaultValue={initial.title ?? ""} required span={2} />
          <SelectField name="content_type" label="نوع المحتوى" defaultValue={initial.content_type ?? "post"} options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))} />
          <SelectField name="priority" label="الأولوية" defaultValue={initial.priority ?? "normal"} options={Object.entries(priorityLabels).map(([value, label]) => ({ value, label }))} />
          <TextField name="goal" label="الهدف" defaultValue={initial.goal ?? ""} />
          <TextField name="audience" label="الجمهور" defaultValue={initial.audience ?? ""} />
          <TextField name="topic" label="الموضوع" defaultValue={initial.topic ?? ""} />
          <TextField name="tags" label="الوسوم" defaultValue={(initial.tags ?? []).join(" ")} />
          <TextAreaField name="description" label="الوصف" rows={2} defaultValue={initial.description ?? ""} />
          <TextAreaField name="hook" label="الافتتاحية (Hook)" rows={2} defaultValue={initial.hook ?? ""} />
          <TextAreaField name="key_message" label="الرسالة الأساسية" rows={2} defaultValue={initial.key_message ?? ""} />
          <TextField name="cta" label="الدعوة لاتخاذ إجراء (CTA)" defaultValue={initial.cta ?? ""} span="all" />
        </div>
        <div className="bos-row" style={{ gap: 10, flexWrap: "wrap", marginTop: 8 }}>
          {platformOptions.map((p) => <label key={p.value} className="bos-check"><input type="checkbox" name="platforms[]" value={p.value} defaultChecked={initial.platforms?.includes(p.value)} /> <Tx>{p.label}</Tx></label>)}
        </div>
      </FormSection>
      <FormSection title="التنفيذ">
        <div className="bos-form-grid">
          {canAssign ? <SelectField name="owner_id" label="المسؤول" placeholder="أنا" options={staff} defaultValue={initial.owner_id ?? ""} /> : <input type="hidden" name="owner_id" value={initial.owner_id ?? ""} />}
          <TextField name="deadline" label="الموعد النهائي" type="date" defaultValue={initial.deadline ?? ""} />
          <TextField name="publish_date" label="موعد النشر" type="datetime-local" defaultValue={toLocal(initial.publish_date)} />
          <TextField name="video_length_sec" label="مدة الفيديو (ثانية)" type="number" min={1} defaultValue={initial.video_length_sec != null ? String(initial.video_length_sec) : ""} />
          <TextAreaField name="script" label="السكريبت" rows={8} defaultValue={initial.script ?? ""} />
          <TextAreaField name="final_version" label="النسخة النهائية" rows={6} defaultValue={initial.final_version ?? ""} hint="تغيير السكريبت أو النسخة النهائية بعد الاعتماد يعيد المحتوى للمراجعة." />
          <TextAreaField name="published_links" label="روابط النشر" rows={2} defaultValue={(initial.published_links ?? []).join("\n")} />
          <TextAreaField name="notes" label="ملاحظات" rows={2} defaultValue={initial.notes ?? ""} />
        </div>
      </FormSection>
      <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
    </ActionForm>
  );
}

export function StageControls({ id, stage, stages, isReview, canApprove, approved }: { id: string; stage: string; stages: { key: string; name: string; requires_approval: boolean }[]; isReview: boolean; canApprove: boolean; approved: boolean }) {
  const t = useT();
  const { pending, msg, run } = useRun();
  const [note, setNote] = useState("");
  return (
    <div className="bos-row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <select className="bos-select-small" value="" disabled={pending} onChange={(e) => e.target.value && run(() => stageAction(id, "move", e.target.value))} aria-label={t("نقل إلى مرحلة")}>
        <option value="">{t("نقل إلى…")}</option>
        {stages.filter((s) => s.key !== stage && s.key !== "approved").map((s) => <option key={s.key} value={s.key} disabled={s.requires_approval && !approved}>{t(s.name)}{s.requires_approval && !approved ? ` 🔒` : ""}</option>)}
      </select>
      {isReview && canApprove ? (
        <>
          <button type="button" className="admin-btn small" disabled={pending} onClick={() => run(() => stageAction(id, "approve", note || null))}><Tx>اعتماد</Tx></button>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("ملاحظات المراجعة")} style={{ minWidth: 200 }} />
          <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => run(() => stageAction(id, "changes", note))}><Tx>طلب تعديلات</Tx></button>
        </>
      ) : null}
      <Msg msg={msg} />
    </div>
  );
}

export function TaskList({ itemId, tasks, staff, names }: { itemId: string; tasks: { id: string; title: string; assignee_id: string | null; due_date: string | null; done_at: string | null }[]; staff: O[]; names: Record<string, string> }) {
  const t = useT();
  const { pending, msg, run } = useRun();
  const [title, setTitle] = useState("");
  const [who, setWho] = useState("");
  const [due, setDue] = useState("");
  return (
    <div className="bos-stack" style={{ gap: 6 }}>
      {tasks.map((x) => (
        <div key={x.id} className="bos-row" style={{ gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={!!x.done_at} disabled={pending} onChange={(e) => run(() => taskAction(e.target.checked ? "done" : "undo", x.id))} aria-label={x.title} />
          <span style={{ textDecoration: x.done_at ? "line-through" : undefined, flex: 1 }}>{x.title}</span>
          <span className="bos-faint" style={{ fontSize: 12 }}>{x.assignee_id ? names[x.assignee_id] ?? "—" : ""}{x.due_date ? ` · ${x.due_date}` : ""}</span>
          <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => run(() => taskAction("delete", x.id))} aria-label={t("حذف")}>×</button>
        </div>
      ))}
      <div className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("مهمة جديدة…")} style={{ flex: 1, minWidth: 180 }} />
        <select value={who} onChange={(e) => setWho(e.target.value)} className="bos-select-small" aria-label={t("المسؤول")}><option value="">{t("المسؤول")}</option>{staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label={t("الموعد")} />
        <button type="button" className="admin-btn small secondary" disabled={pending || !title.trim()} onClick={() => { run(() => taskAction("add", itemId, { title, assignee_id: who || null, due_date: due || null })); setTitle(""); }}><Tx>إضافة</Tx></button>
      </div>
      <Msg msg={msg} />
    </div>
  );
}

const acceptOptions = [{ value: "script", label: "السكريبت" }, { value: "final_version", label: "النسخة النهائية" }, { value: "hook", label: "الافتتاحية" }, { value: "cta", label: "CTA" }, { value: "description", label: "الوصف" }, { value: "key_message", label: "الرسالة الأساسية" }, { value: "notes", label: "الملاحظات" }];

export function AiPanel({ itemId, drafts, aiReady }: { itemId: string | null; drafts: { id: string; kind: string; output: string; status: string; accepted_into: string | null; created_at: string; provider: string | null }[]; aiReady: boolean }) {
  const t = useT();
  const router = useRouter();
  const [kind, setKind] = useState(itemId ? "hooks" : "ideas");
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [instr, setInstr] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="bos-stack" style={{ gap: 10 }}>
      {!aiReady ? <p className="bos-hint"><Tx>لا يوجد مزود ذكاء اصطناعي متصل — أضف مفتاحاً من مركز التكاملات.</Tx></p> : null}
      <div className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="bos-select-small" aria-label={t("نوع الكتابة")}>{Object.entries(kindLabels).filter(([k]) => k !== "insights").map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
        <select value={lang} onChange={(e) => setLang(e.target.value as "ar" | "en")} className="bos-select-small" aria-label={t("اللغة")}><option value="ar">العربية</option><option value="en">English</option></select>
        <input value={instr} onChange={(e) => setInstr(e.target.value)} placeholder={t("تعليمات إضافية (اختياري)")} style={{ flex: 1, minWidth: 200 }} maxLength={2000} />
        <button type="button" className="admin-btn small" disabled={pending || !aiReady} onClick={() => start(async () => { setErr(null); const r = await generateAction(itemId, kind, instr, lang); if (!r.ok) setErr(r.error); router.refresh(); })}>{pending ? t("جارٍ التوليد…") : t("توليد")}</button>
      </div>
      {err ? <span className="bos-danger" style={{ fontSize: 12 }}>{t(err)}</span> : null}
      <p className="bos-faint" style={{ fontSize: 12, margin: 0 }}><Tx>ما يولّده الذكاء الاصطناعي مسودة فقط — راجعه وعدّله ثم انسخه إلى المحتوى. لا يُنشر شيء تلقائياً.</Tx></p>
      {drafts.map((d) => <DraftCard key={d.id} d={d} canAccept={!!itemId} />)}
    </div>
  );
}

function DraftCard({ d, canAccept }: { d: { id: string; kind: string; output: string; status: string; accepted_into: string | null; created_at: string; provider: string | null }; canAccept: boolean }) {
  const t = useT();
  const { pending, msg, run } = useRun();
  const [text, setText] = useState(d.output);
  const [field, setField] = useState("script");
  return (
    <div style={{ border: "1px solid var(--bos-border)", borderRadius: 10, padding: 10 }}>
      <div className="bos-faint" style={{ fontSize: 12, marginBottom: 4 }}><Tx>{kindLabels[d.kind] ?? d.kind}</Tx> · {d.provider ?? ""} · {new Date(d.created_at).toLocaleString()}{d.status === "accepted" ? <> · <Tx>نُسخ إلى</Tx> <Tx>{acceptOptions.find((o) => o.value === d.accepted_into)?.label ?? d.accepted_into ?? ""}</Tx></> : null}</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(14, Math.max(4, text.split("\n").length + 1))} style={{ width: "100%" }} dir="auto" />
      <div className="bos-row" style={{ gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
        {canAccept ? (
          <>
            <select value={field} onChange={(e) => setField(e.target.value)} className="bos-select-small" aria-label={t("نسخ إلى")}>{acceptOptions.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}</select>
            <button type="button" className="admin-btn small secondary" disabled={pending} onClick={() => run(() => draftAction(d.id, "accept", field as "script", text))}><Tx>نسخ إلى المحتوى</Tx></button>
          </>
        ) : null}
        <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => navigator.clipboard?.writeText(text)}><Tx>نسخ النص</Tx></button>
        <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => run(() => draftAction(d.id, "discard"))}><Tx>تجاهل</Tx></button>
        <Msg msg={msg} />
      </div>
    </div>
  );
}

export function StagesEditor({ stages }: { stages: { key: string; name: string; is_core: boolean; is_active: boolean; requires_approval: boolean; is_review: boolean }[] }) {
  const t = useT();
  const [order, setOrder] = useState(stages.map((s) => s.key));
  const { pending, msg, run } = useRun();
  const move = (i: number, d: -1 | 1) => setOrder((o) => { const n = [...o]; const j = i + d; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j], n[i]]; return n; });
  return (
    <ActionForm action={saveStagesAction} successMessage="تم الحفظ">
      <BosTable className="bos-table">
        <thead><tr><th /><th><Tx>المرحلة</Tx></th><th><Tx>مفعّلة</Tx></th><th><Tx>تتطلب اعتماداً</Tx></th><th /></tr></thead>
        <tbody>
          {order.map((k, i) => {
            const s = stages.find((x) => x.key === k)!;
            return (
              <tr key={k}>
                <td className="bos-nowrap"><input type="hidden" name="key[]" value={k} /><button type="button" className="admin-btn small ghost" onClick={() => move(i, -1)} aria-label={t("أعلى")}>↑</button><button type="button" className="admin-btn small ghost" onClick={() => move(i, 1)} aria-label={t("أسفل")}>↓</button></td>
                <td><input name={`name_${k}`} defaultValue={s.name} required /> <span className="bos-faint" dir="ltr" style={{ fontSize: 11 }}>{k}</span>{s.is_core ? <span className="bos-tag" style={{ marginInlineStart: 4 }}><Tx>أساسية</Tx></span> : null}{s.is_review ? <span className="bos-tag" style={{ marginInlineStart: 4 }}><Tx>مراجعة</Tx></span> : null}</td>
                <td><input type="checkbox" name={`active_${k}`} defaultChecked={s.is_active} disabled={s.is_core} />{s.is_core ? <input type="hidden" name={`active_${k}`} value="on" /> : null}</td>
                <td><input type="checkbox" name={`gate_${k}`} defaultChecked={s.requires_approval} disabled={s.is_core || s.is_review} />{(s.is_core || s.is_review) && s.requires_approval ? <input type="hidden" name={`gate_${k}`} value="on" /> : null}</td>
                <td>{!s.is_core ? <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => { if (window.confirm(t("حذف المرحلة؟"))) run(() => removeStageAction(k)); }}><Tx>حذف</Tx></button> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </BosTable>
      <FormSection title="إضافة مرحلة">
        <div className="bos-form-grid">
          <TextField name="new_key" label="المفتاح" dir="ltr" placeholder="voiceover" hint="حروف إنجليزية صغيرة وأرقام و _" />
          <TextField name="new_name" label="الاسم" />
          <SelectField name="new_after" label="بعد" options={stages.map((s) => ({ value: s.key, label: s.name }))} defaultValue={stages[stages.length - 2]?.key} />
        </div>
      </FormSection>
      <div className="bos-form-actions"><SubmitButton label="حفظ" /> <Msg msg={msg} /></div>
    </ActionForm>
  );
}
