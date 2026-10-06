"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/bos/Form";
import { Tx } from "@/components/bos/I18n";
import { updateSettingAction } from "../providers/actions";

type Provider = "anthropic" | "openai" | "gemini";
type Route = { provider: Provider; model: string };
const providers: Provider[] = ["anthropic", "openai", "gemini"];

/** Route order per task, edited as rows (saved as the validated llm_routing setting). */
export function RoutingForm({ initial, tasks }: { initial: Record<string, Route[]>; tasks: { id: string; label: string; hint: string }[] }) {
  const [routing, setRouting] = useState<Record<string, Route[]>>(() => {
    const out: Record<string, Route[]> = { ...initial };
    for (const t of tasks) out[t.id] ??= [];
    return out;
  });
  const set = (task: string, rows: Route[]) => setRouting((r) => ({ ...r, [task]: rows }));
  // Tasks without rows use "default"; only keep tasks that have routes.
  const value = JSON.stringify(Object.fromEntries(Object.entries(routing).filter(([, rows]) => rows.length)));
  return (
    <ActionForm action={updateSettingAction} successMessage="تم الحفظ">
      <input type="hidden" name="key" value="llm_routing" />
      <input type="hidden" name="value" value={value} />
      <div style={{ display: "grid", gap: 18 }}>
        {tasks.map((t) => {
          const rows = routing[t.id] ?? [];
          return (
            <div key={t.id} className="llm-task">
              <div><strong><Tx>{t.label}</Tx></strong> <span className="cell-sub" dir="ltr">{t.id}</span></div>
              <div className="bos-faint" style={{ fontSize: 12 }}><Tx>{t.hint}</Tx></div>
              {rows.length === 0 && <div className="bos-faint" style={{ fontSize: 12 }}><Tx>يستخدم مسار default.</Tx></div>}
              {rows.map((r, i) => (
                <div key={i} className="llm-route-row">
                  <span className="bos-num">{i + 1}</span>
                  <select className="llm-input" value={r.provider} onChange={(e) => set(t.id, rows.map((x, j) => (j === i ? { ...x, provider: e.target.value as Provider } : x)))}>
                    {providers.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input className="llm-input" dir="ltr" value={r.model} placeholder="model id" onChange={(e) => set(t.id, rows.map((x, j) => (j === i ? { ...x, model: e.target.value } : x)))} />
                  <button type="button" className="admin-btn secondary" disabled={i === 0} onClick={() => set(t.id, rows.map((x, j) => (j === i - 1 ? rows[i] : j === i ? rows[i - 1] : x)))}>↑</button>
                  <button type="button" className="admin-btn secondary" onClick={() => set(t.id, rows.filter((_, j) => j !== i))}><Tx>حذف</Tx></button>
                </div>
              ))}
              {rows.length < 6 && <button type="button" className="admin-btn secondary" onClick={() => set(t.id, [...rows, { provider: "anthropic", model: "" }])}><Tx>إضافة مزود</Tx></button>}
            </div>
          );
        })}
      </div>
      <SubmitButton />
    </ActionForm>
  );
}

type Price = { input: number; output: number; cache_read_multiplier?: number; cache_write_multiplier?: number };

/** USD per million tokens per model (saved as the validated llm_prices setting). */
export function PricesForm({ initial }: { initial: Record<string, Price> }) {
  const [rows, setRows] = useState(() => Object.entries(initial).map(([model, p]) => ({ model, input: String(p.input), output: String(p.output), read: p.cache_read_multiplier == null ? "" : String(p.cache_read_multiplier), write: p.cache_write_multiplier == null ? "" : String(p.cache_write_multiplier) })));
  const value = JSON.stringify(Object.fromEntries(rows.filter((r) => r.model.trim()).map((r) => [r.model.trim(), {
    input: Number(r.input), output: Number(r.output),
    ...(r.read ? { cache_read_multiplier: Number(r.read) } : {}), ...(r.write ? { cache_write_multiplier: Number(r.write) } : {}),
  }])));
  const set = (i: number, k: keyof (typeof rows)[number], v: string) => setRows((cur) => cur.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <ActionForm action={updateSettingAction} successMessage="تم الحفظ">
      <input type="hidden" name="key" value="llm_prices" />
      <input type="hidden" name="value" value={value} />
      <table className="bos-table">
        <thead><tr><th><Tx>النموذج</Tx></th><th><Tx>الإدخال $/مليون</Tx></th><th><Tx>الإخراج $/مليون</Tx></th><th><Tx>معامل قراءة الكاش</Tx></th><th><Tx>معامل كتابة الكاش</Tx></th><th></th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><input className="llm-input" dir="ltr" value={r.model} onChange={(e) => set(i, "model", e.target.value)} /></td>
              <td><input className="llm-input" type="number" min={0} step="any" value={r.input} onChange={(e) => set(i, "input", e.target.value)} /></td>
              <td><input className="llm-input" type="number" min={0} step="any" value={r.output} onChange={(e) => set(i, "output", e.target.value)} /></td>
              <td><input className="llm-input" type="number" min={0} step="any" value={r.read} onChange={(e) => set(i, "read", e.target.value)} /></td>
              <td><input className="llm-input" type="number" min={0} step="any" value={r.write} onChange={(e) => set(i, "write", e.target.value)} /></td>
              <td><button type="button" className="admin-btn secondary" onClick={() => setRows((cur) => cur.filter((_, j) => j !== i))}><Tx>حذف</Tx></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button type="button" className="admin-btn secondary" onClick={() => setRows((cur) => [...cur, { model: "", input: "", output: "", read: "", write: "" }])}><Tx>إضافة نموذج</Tx></button>
        <SubmitButton />
      </div>
    </ActionForm>
  );
}
