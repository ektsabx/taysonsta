"use client";

import { Tx, Opt } from "@/components/bos/I18n";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSettingAction } from "./actions";

export type SField =
  | { path: string; label: string; type: "text" | "number" | "boolean" | "date"; hint?: string; min?: number; max?: number }
  | { path: string; label: string; type: "select"; options: { value: string; label: string }[]; hint?: string }
  | { path: string; label: string; type: "multiselect"; options: { value: string; label: string }[]; hint?: string }
  | { path: string; label: string; type: "list"; hint?: string }
  | { path: string; label: string; type: "json"; hint?: string }
  // Hex colour; `optional` allows "" (= theme default).
  | { path: string; label: string; type: "color"; hint?: string; optional?: boolean };

function get(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}
function setIn(obj: Record<string, unknown>, path: string, v: unknown): Record<string, unknown> {
  const [k, ...rest] = path.split(".");
  return { ...obj, [k]: rest.length ? setIn((obj[k] as Record<string, unknown>) ?? {}, rest.join("."), v) : v };
}

function JsonInput({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(JSON.stringify(value ?? null, null, 2));
  const [bad, setBad] = useState(false);
  return (
    <>
      <textarea dir="ltr" rows={5} style={{ fontFamily: "monospace", fontSize: 12 }} value={text} onChange={(e) => { setText(e.target.value); try { onChange(JSON.parse(e.target.value)); setBad(false); } catch { setBad(true); } }} />
      {bad ? <span className="bos-field-error"><Tx>JSON غير صالح</Tx></span> : null}
    </>
  );
}

// Form for one bos_settings key; the server re-validates with the zod schema.
export function SettingsForm({ settingKey, value, fields, title }: { settingKey: string; value: Record<string, unknown>; fields: SField[]; title?: string }) {
  const [state, setState] = useState(value);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = () => start(async () => {
    // Send only this form's fields; the server merges them into the current
    // value so several forms on one setting never overwrite each other.
    let patch: Record<string, unknown> = {};
    for (const f of fields) patch = setIn(patch, f.path, get(state, f.path));
    const r = await saveSettingAction(settingKey, JSON.stringify(patch));
    setMsg(r.ok ? { ok: true, text: r.message ?? "تم" } : { ok: false, text: r.error });
    router.refresh();
  });
  return (
    <div>
      {title ? <strong style={{ display: "block", marginBottom: 8 }}><Tx>{title}</Tx></strong> : null}
      <div className="bos-form-grid">
        {fields.map((f) => {
          const v = get(state, f.path);
          const set = (nv: unknown) => setState(setIn(state, f.path, nv));
          return (
            <div key={f.path} className="bos-field" style={f.type === "json" ? { gridColumn: "1 / -1" } : undefined}>
              <label><Tx>{f.label}</Tx></label>
              {f.type === "boolean" ? <input type="checkbox" checked={Boolean(v)} onChange={(e) => set(e.target.checked)} />
                : f.type === "number" ? <input type="number" value={v === null || v === undefined ? "" : String(v)} min={f.min} max={f.max} onChange={(e) => set(e.target.value === "" ? null : Number(e.target.value))} />
                : f.type === "date" ? <input type="date" value={String(v ?? "")} onChange={(e) => set(e.target.value || null)} />
                : f.type === "select" ? <select value={String(v ?? "")} onChange={(e) => set(e.target.value || null)}>{f.options.map((o) => <Opt key={o.value} value={o.value}>{o.label}</Opt>)}</select>
                : f.type === "multiselect" ? <div className="bos-row" style={{ gap: 12, flexWrap: "wrap" }}>{f.options.map((o) => { const cur = (v as string[]) ?? []; return <label key={o.value} className="bos-check"><input type="checkbox" checked={cur.includes(o.value)} onChange={(e) => set(e.target.checked ? [...cur, o.value] : cur.filter((x) => x !== o.value))} /> <Tx>{o.label}</Tx></label>; })}</div>
                : f.type === "list" ? <input value={((v as string[]) ?? []).join(", ")} onChange={(e) => set(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} dir="ltr" />
                : f.type === "json" ? <JsonInput value={v} onChange={set} />
                : f.type === "color" ? (
                  <div className="bos-color-input">
                    <input type="color" aria-label={f.label} value={/^#[0-9a-fA-F]{6}$/.test(String(v ?? "")) ? String(v) : "#888888"} onChange={(e) => set(e.target.value)} />
                    <input dir="ltr" value={String(v ?? "")} placeholder={f.optional ? "—" : "#RRGGBB"} onChange={(e) => set(e.target.value.trim())} />
                    {f.optional && v ? <button type="button" className="admin-btn small ghost" onClick={() => set("")}><Tx>افتراضي</Tx></button> : null}
                  </div>
                )
                : <input value={String(v ?? "")} onChange={(e) => set(e.target.value)} />}
              {f.hint ? <span className="bos-hint"><Tx>{f.hint}</Tx></span> : null}
            </div>
          );
        })}
      </div>
      {msg ? <div className={msg.ok ? "bos-form-success" : "bos-form-error"} style={{ marginTop: 8 }}><Tx>{msg.text}</Tx></div> : null}
      <div className="bos-form-actions"><button type="button" className="admin-btn small" disabled={pending} onClick={save}><Tx>{pending ? "جارٍ الحفظ..." : "حفظ"}</Tx></button></div>
    </div>
  );
}
