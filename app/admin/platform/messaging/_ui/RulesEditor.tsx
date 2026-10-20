"use client";

import { useState, useTransition } from "react";
import { Tx, useT } from "@/components/bos/I18n";
import { FIELDS, OPS, fieldDef } from "../../../../../Yolias/lib/messaging/catalog";
import type { Rule } from "../../../../../Yolias/lib/messaging/rules";
import { countAudienceAction } from "../actions";

// Conditions on user facts, all of which must hold (segments, flow entry and
// exit, branches, campaign audience). Kept as JSON in a hidden input.

const blank = (): Rule => ({ field: "has_plan", op: "is", value: false });

function defaultValue(field: string): Rule["value"] {
  const d = fieldDef(field);
  if (!d) return "";
  if (d.type === "bool") return true;
  if (d.type === "number") return 0;
  if (d.type === "enum") return [d.options?.[0]?.value ?? ""];
  return "";
}

export function RuleRows({ rules, onChange, events = true }: { rules: Rule[]; onChange: (r: Rule[]) => void; events?: boolean }) {
  const t = useT();
  const set = (i: number, patch: Partial<Rule>) => onChange(rules.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const fields = FIELDS.filter((f) => events || !f.id.startsWith("event."));
  return (
    <div className="msg-rules">
      {rules.length === 0 && <p className="bos-faint msg-rules-empty"><Tx>بدون شروط: ينطبق على الجميع.</Tx></p>}
      {rules.map((r, i) => {
        const def = fieldDef(r.field);
        const ops = def ? OPS[def.type] : [];
        return (
          <div className="msg-rule" key={i}>
            <select aria-label={t("الحقل")} value={r.field} onChange={(e) => { const f = e.target.value; const d = fieldDef(f); set(i, { field: f, op: (d ? OPS[d.type][0].value : "is") as Rule["op"], value: defaultValue(f) }); }}>
              {fields.map((f) => <option key={f.id} value={f.id}>{t(f.label)}</option>)}
            </select>
            <select aria-label={t("الشرط")} value={r.op} onChange={(e) => set(i, { op: e.target.value as Rule["op"] })}>
              {ops.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
            </select>
            {r.op === "exists" || r.op === "not_exists" ? <span /> : def?.type === "bool" ? (
              <select aria-label={t("القيمة")} value={String(r.value)} onChange={(e) => set(i, { value: e.target.value === "true" })}>
                <option value="true">{t("نعم")}</option><option value="false">{t("لا")}</option>
              </select>
            ) : def?.type === "number" ? (
              <input aria-label={t("القيمة")} type="number" value={typeof r.value === "number" ? r.value : 0} onChange={(e) => set(i, { value: Number(e.target.value) })} />
            ) : def?.type === "enum" ? (
              <span className="msg-rule-options">
                {def.options!.map((o) => {
                  const list = Array.isArray(r.value) ? r.value : [];
                  return (
                    <label key={o.value} className="bos-check">
                      <input type="checkbox" checked={list.includes(o.value)} onChange={(e) => set(i, { value: e.target.checked ? [...list, o.value] : list.filter((x) => x !== o.value) })} />
                      {t(o.label)}
                    </label>
                  );
                })}
              </span>
            ) : (
              <input aria-label={t("القيمة")} dir="auto" value={typeof r.value === "string" ? r.value : ""} onChange={(e) => set(i, { value: e.target.value })} />
            )}
            <button type="button" className="admin-btn secondary small" onClick={() => onChange(rules.filter((_, k) => k !== i))} aria-label={t("حذف الشرط")}>×</button>
          </div>
        );
      })}
      <button type="button" className="admin-btn secondary small" onClick={() => onChange([...rules, blank()])}><Tx>+ شرط</Tx></button>
    </div>
  );
}

/** A labelled rule editor bound to a hidden input, with an optional live audience count. */
export function RulesField({ name, label, hint, defaultRules, count, category, events = true }: { name: string; label: string; hint?: string; defaultRules: Rule[]; count?: boolean; category?: string; events?: boolean }) {
  const [rules, setRules] = useState<Rule[]>(defaultRules);
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const t = useT();
  const run = () => start(async () => {
    setResult(null);
    const r = await countAudienceAction(JSON.stringify(rules), category ?? "marketing");
    if (!r.ok) setResult(t(r.error));
    else if (r.data) setResult(`${t("يطابق")} ${r.data.matching} · ${t("يمكن مراسلته")} ${r.data.reachable}${r.data.capped ? ` (${t("أول 50,000 مستخدم")})` : ""}${r.data.sample.length ? ` · ${r.data.sample.join("، ")}` : ""}`);
  });
  return (
    <div className="bos-field span-all">
      <label><Tx>{label}</Tx></label>
      <input type="hidden" name={name} value={JSON.stringify(rules)} />
      <RuleRows rules={rules} onChange={setRules} events={events} />
      {hint ? <span className="bos-hint"><Tx>{hint}</Tx></span> : null}
      {count && (
        <div className="msg-count">
          <button type="button" className="admin-btn secondary small" onClick={run} disabled={pending}>{t(pending ? "جارٍ العد…" : "عدّ المستخدمين الآن")}</button>
          {result && <span className="bos-hint" dir="auto" role="status">{result}</span>}
        </div>
      )}
    </div>
  );
}
