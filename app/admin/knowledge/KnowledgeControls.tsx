"use client";

import { Tx, Opt } from "@/components/bos/I18n";

import { useState } from "react";
import { ActionButton } from "@/components/bos/Dialog";
import { ActionForm, SubmitButton } from "@/components/bos/Form";
import { markReadAction, saveStepsAction, setArticleStatusAction } from "./actions";

export function MarkReadButton({ id, label = "تم الاطلاع" }: { id: string; label?: string }) {
  return <ActionButton label={label} className="admin-btn small" action={() => markReadAction(id)} />;
}

export function StatusButtons({ id, status }: { id: string; status: string }) {
  return (
    <>
      {status !== "published" ? <ActionButton label="نشر" className="admin-btn small success" action={() => setArticleStatusAction(id, "published")} /> : null}
      {status === "published" ? <ActionButton label="إلغاء النشر" className="admin-btn small ghost" action={() => setArticleStatusAction(id, "draft")} /> : null}
      {status !== "archived" ? <ActionButton label="أرشفة" className="admin-btn small ghost" action={() => setArticleStatusAction(id, "archived")} /> : null}
    </>
  );
}

// Interactive SOP checklist run-through (local only, not persisted).
export function ChecklistRunner({ items }: { items: { id: string; title: string; description: string | null }[] }) {
  const [done, setDone] = useState<string[]>([]);
  return (
    <div className="bos-stack" style={{ gap: 6 }}>
      {items.map((i) => (
        <label key={i.id} className="bos-check" style={{ display: "flex", alignItems: "flex-start" }}>
          <input type="checkbox" checked={done.includes(i.id)} onChange={(e) => setDone(e.target.checked ? [...done, i.id] : done.filter((x) => x !== i.id))} />
          <span style={done.includes(i.id) ? { textDecoration: "line-through", opacity: 0.7 } : undefined}>{i.title}{i.description ? <span className="cell-sub"><Tx>{i.description}</Tx></span> : null}</span>
        </label>
      ))}
      <div className="bos-faint" style={{ fontSize: 12 }}>{done.length}/{items.length} مكتمل {done.length === items.length && items.length ? "✓" : ""}</div>
      {done.length ? <button type="button" className="admin-btn small ghost" onClick={() => setDone([])}><Tx>إعادة البدء</Tx></button> : null}
    </div>
  );
}

export function StepsEditor({ articleId, initial }: { articleId: string; initial: { kind: string; title: string; description: string | null }[] }) {
  const [rows, setRows] = useState(initial.length ? initial : [{ kind: "step", title: "", description: null }]);
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };
  return (
    <ActionForm action={saveStepsAction.bind(null, articleId)} successMessage="تم الحفظ">
      {rows.map((r, i) => (
        <div key={i} className="bos-row" style={{ gap: 6, marginBottom: 6, alignItems: "flex-start" }}>
          <select name="step_kind[]" value={r.kind} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))} aria-label="النوع">
            <Opt value="step">خطوة</Opt>
            <Opt value="checklist">بند تحقق</Opt>
          </select>
          <input name="step_title[]" value={r.title} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="العنوان" style={{ flex: 1 }} aria-label="العنوان" />
          <input name="step_desc[]" value={r.description ?? ""} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="تفاصيل (اختياري)" style={{ flex: 1 }} aria-label="التفاصيل" />
          <button type="button" className="admin-btn small ghost" onClick={() => move(i, -1)} aria-label="أعلى">↑</button>
          <button type="button" className="admin-btn small ghost" onClick={() => move(i, 1)} aria-label="أسفل">↓</button>
          <button type="button" className="admin-btn small ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="حذف">×</button>
        </div>
      ))}
      <div className="bos-row" style={{ gap: 6 }}>
        <button type="button" className="admin-btn small ghost" onClick={() => setRows([...rows, { kind: "step", title: "", description: null }])}><Tx>+ خطوة</Tx></button>
        <button type="button" className="admin-btn small ghost" onClick={() => setRows([...rows, { kind: "checklist", title: "", description: null }])}><Tx>+ بند تحقق</Tx></button>
        <SubmitButton label="حفظ الخطوات" className="admin-btn small" />
      </div>
    </ActionForm>
  );
}
