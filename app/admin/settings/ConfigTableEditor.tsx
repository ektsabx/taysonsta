"use client";
import { BosTable } from "@/components/bos/BosTable";

import { Tx, Opt } from "@/components/bos/I18n";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FieldSpec, TableSpec } from "@/lib/bos/config-tables";
import { Modal } from "@/components/bos/Dialog";
import { removeConfigRowAction, saveConfigRowAction } from "./actions";

type Opt = { value: string; label: string };
export interface Lookups { users: Opt[]; roles: Opt[]; departments: Opt[]; products: Opt[]; currencies: string[] }

const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function display(f: FieldSpec, v: unknown, lk: Lookups) {
  if (v === null || v === undefined || v === "") return "—";
  const find = (opts: Opt[]) => opts.find((o) => o.value === v)?.label ?? String(v);
  switch (f.type) {
    case "boolean": return v ? "✓" : "—";
    case "user": return find(lk.users);
    case "role": return find(lk.roles);
    case "department": return find(lk.departments);
    case "product": return find(lk.products);
    case "select": return f.options?.find((o) => o.value === v)?.label ?? String(v);
    case "weekdays": return (v as number[]).map((d) => days[d]).join("، ");
    case "time": return String(v).slice(0, 5);
    case "json": return `${(v as unknown[]).length} عنصر`;
    case "list": return (v as string[]).join("، ") || "—";
    default: return Array.isArray(v) ? v.join(", ") : String(v);
  }
}

function Input({ f, value, set, lk }: { f: FieldSpec; value: unknown; set: (v: unknown) => void; lk: Lookups }) {
  const sel = (opts: Opt[]) => <select value={String(value ?? "")} onChange={(e) => set(e.target.value)}><option value="">—</option>{opts.map((o) => <Opt key={o.value} value={o.value}>{o.label}</Opt>)}</select>;
  switch (f.type) {
    case "textarea": return <textarea rows={3} value={String(value ?? "")} onChange={(e) => set(e.target.value)} />;
    case "json": return <textarea rows={6} dir="ltr" style={{ fontFamily: "monospace", fontSize: 12 }} value={typeof value === "string" ? value : JSON.stringify(value ?? [], null, 2)} onChange={(e) => set(e.target.value)} />;
    case "number": return <input type="number" value={value === null || value === undefined ? "" : String(value)} min={f.min} max={f.max} step="any" onChange={(e) => set(e.target.value)} />;
    case "money": return <input inputMode="decimal" dir="ltr" value={value === null || value === undefined ? "" : String(value)} onChange={(e) => set(e.target.value)} />;
    case "boolean": return <input type="checkbox" checked={Boolean(value)} onChange={(e) => set(e.target.checked)} />;
    case "date": return <input type="date" value={String(value ?? "")} onChange={(e) => set(e.target.value)} />;
    case "time": return <input type="time" value={String(value ?? "").slice(0, 5)} onChange={(e) => set(e.target.value)} />;
    case "select": return sel(f.options ?? []);
    case "user": return sel(lk.users);
    case "role": return sel(lk.roles);
    case "department": return sel(lk.departments);
    case "product": return sel(lk.products);
    case "currency": return sel(lk.currencies.map((c) => ({ value: c, label: c })));
    case "list": return <input dir="ltr" value={Array.isArray(value) ? value.join(", ") : String(value ?? "")} onChange={(e) => set(e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} />;
    case "weekdays": {
      const arr = Array.isArray(value) ? (value as number[]) : [];
      return <div className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>{days.map((d, i) => <label key={i} className="bos-check"><input type="checkbox" checked={arr.includes(i)} onChange={(e) => set(e.target.checked ? [...arr, i].sort() : arr.filter((x) => x !== i))} />{d}</label>)}</div>;
    }
    default: return <input value={Array.isArray(value) ? value.join(", ") : String(value ?? "")} dir={f.pattern ? "ltr" : undefined} onChange={(e) => set(e.target.value)} />;
  }
}

// Generic CRUD editor for configuration tables (validated + audited server-side).
export function ConfigTableEditor({ spec, tableKey, rows, lookups, canEdit = true, defaults = {} }: { spec: TableSpec; tableKey: string; rows: Record<string, unknown>[]; lookups: Lookups; canEdit?: boolean; defaults?: Record<string, unknown> }) {
  const pk = spec.pk ?? "id";
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const listed = spec.fields.filter((f) => f.listed);
  const save = () =>
    start(async () => {
      setErrors({});
      const id = editing?.__id as string | undefined;
      const values: Record<string, unknown> = {};
      for (const f of spec.fields) values[f.key] = editing?.[f.key];
      const r = await saveConfigRowAction(tableKey, id ?? null, JSON.stringify(values));
      if (r.ok) {
        setEditing(null);
        setMsg(r.message ?? null);
        router.refresh();
      } else {
        setErrors({ ...(r.fieldErrors ?? {}), _: r.error });
      }
    });
  const remove = (id: string) =>
    start(async () => {
      if (!confirm("حذف السجل؟ إذا كان مستخدماً سيُعطَّل بدلاً من الحذف.")) return;
      const r = await removeConfigRowAction(tableKey, id);
      setMsg(r.ok ? r.message ?? null : r.error);
      router.refresh();
    });
  return (
    <div>
      <div className="bos-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <strong><Tx>{spec.title}</Tx> <span className="bos-faint">({rows.length})</span></strong>
        {canEdit ? <button type="button" className="admin-btn small" onClick={() => setEditing({ ...defaults })}><Tx>+ إضافة</Tx></button> : null}
      </div>
      {msg ? <div className="bos-faint" style={{ fontSize: 12.5, marginBottom: 6 }}><Tx>{msg}</Tx></div> : null}
      <div className="bos-table-scroll">
        <BosTable className="bos-table responsive">
          <thead><tr>{listed.map((f) => <th key={f.key}><Tx>{f.label}</Tx></th>)}{canEdit ? <th className="col-actions" /> : null}</tr></thead>
          <tbody>
            {rows.map((r) => {
              const inactive = r.is_active === false || !!r.archived_at;
              return (
                <tr key={String(r[pk])} style={inactive ? { opacity: 0.55 } : undefined}>
                  {listed.map((f, i) => <td key={f.key} className={i === 0 ? "cell-primary" : undefined} data-label={f.label}>{display(f, r[f.key], lookups)}{i === 0 && r.archived_at ? <span className="cell-sub"><Tx>مؤرشف</Tx></span> : null}</td>)}
                  {canEdit ? (
                    <td className="col-actions">
                      <button type="button" className="admin-btn small ghost" onClick={() => setEditing({ ...r, __id: r[pk], ...(r.access_levels ? { access_levels: (r.access_levels as string[]).join(", ") } : {}) })}><Tx>تعديل</Tx></button>
                      <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => remove(String(r[pk]))}><Tx>حذف</Tx></button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </BosTable>
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.__id ? `تعديل — ${spec.title}` : `إضافة — ${spec.title}`} wide>
        {editing ? (
          <div>
            <div className="bos-form-grid">
              {spec.fields.map((f) => (
                <div key={f.key} className="bos-field" style={f.type === "textarea" || f.type === "json" || f.type === "weekdays" ? { gridColumn: "1 / -1" } : undefined}>
                  <label>{f.label}{f.required ? " *" : ""}</label>
                  <Input f={f} value={editing[f.key]} lk={lookups} set={(v) => setEditing({ ...editing, [f.key]: v })} />
                  {f.hint ? <span className="bos-hint" dir="auto"><Tx>{f.hint}</Tx></span> : null}
                  {errors[f.key] ? <span className="bos-field-error">{errors[f.key]}</span> : null}
                </div>
              ))}
            </div>
            {errors._ ? <div className="bos-form-error"><Tx>{errors._}</Tx></div> : null}
            <div className="bos-form-actions"><button type="button" className="admin-btn" disabled={pending} onClick={save}><Tx>{pending ? "جارٍ الحفظ..." : "حفظ"}</Tx></button></div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
