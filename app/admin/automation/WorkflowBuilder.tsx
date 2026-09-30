"use client";

import { Tx, Opt, useT } from "@/components/bos/I18n";

import { useEffect, useState, useTransition } from "react";
import { eventCatalog, eventGroups, eventMap } from "@/lib/bos/event-types";
import { conditionOperators, type Condition, type ConditionOperator } from "@/lib/bos/automation/conditions";
import { actionSpecs, relationOptions, type ParamSpec } from "@/lib/bos/automation/specs";
import { dryRunAction, sampleEventsAction, saveRuleAction } from "./actions";

type Opt = { value: string; label: string };
type Action = { type: string; params: Record<string, unknown> };

export interface RuleDraft {
  id?: string;
  name: string;
  description: string | null;
  trigger_event: string;
  conditions: Condition[];
  condition_logic: "all" | "any";
  actions: Action[];
  is_active: boolean;
  run_once_per_entity: boolean;
  priority: number;
}

function ParamInput({ spec, value, onChange, staff, roles }: { spec: ParamSpec; value: unknown; onChange: (v: unknown) => void; staff: Opt[]; roles: Opt[] }) {
  const tr = useT();
  switch (spec.type) {
    case "textarea":
      return <textarea rows={2} value={String(value ?? "")} placeholder={spec.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return <input type="number" value={value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />;
    case "boolean":
      return <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
    case "select":
      return <select value={String(value ?? spec.options?.[0]?.value ?? "")} onChange={(e) => onChange(e.target.value || undefined)}>{spec.options?.map((o) => <Opt key={o.value} value={o.value}>{o.label}</Opt>)}</select>;
    case "users": {
      const multi = spec.key.endsWith("s");
      if (multi) {
        const arr = Array.isArray(value) ? (value as string[]) : [];
        return <select multiple value={arr} onChange={(e) => onChange(Array.from(e.target.selectedOptions).map((o) => o.value))} style={{ minHeight: 80 }}>{staff.map((s) => <Opt key={s.value} value={s.value}>{s.label}</Opt>)}</select>;
      }
      return <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value || undefined)}><option value="">—</option>{staff.map((s) => <Opt key={s.value} value={s.value}>{s.label}</Opt>)}</select>;
    }
    case "roles": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return <select multiple value={arr} onChange={(e) => onChange(Array.from(e.target.selectedOptions).map((o) => o.value))} style={{ minHeight: 80 }}>{roles.map((r) => <Opt key={r.value} value={r.value}>{r.label}</Opt>)}</select>;
    }
    case "assignee": {
      const v = String(value ?? "");
      return (
        <select value={v} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">—</option>
          <optgroup label={tr("علاقة")}>{relationOptions.map((r) => <Opt key={r.value} value={`relation:${r.value}`}>{r.label}</Opt>)}</optgroup>
          <optgroup label={tr("دور")}>{roles.map((r) => <Opt key={r.value} value={`role:${r.value}`}>{r.label}</Opt>)}</optgroup>
          <optgroup label={tr("شخص")}>{staff.map((s) => <Opt key={s.value} value={`user:${s.value}`}>{s.label}</Opt>)}</optgroup>
        </select>
      );
    }
    case "recipients": {
      const arr = Array.isArray(value) ? (value as { kind: string; value: string }[]) : [];
      const set = (next: { kind: string; value: string }[]) => onChange(next);
      return (
        <div className="bos-stack" style={{ gap: 4 }}>
          {arr.map((r, i) => (
            <div key={i} className="bos-row" style={{ gap: 4 }}>
              <select value={r.kind} onChange={(e) => set(arr.map((x, j) => (j === i ? { kind: e.target.value, value: "" } : x)))}>
                <Opt value="relation">علاقة</Opt>
                <Opt value="role">دور</Opt>
                <Opt value="user">شخص</Opt>
              </select>
              <select value={r.value} onChange={(e) => set(arr.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} style={{ flex: 1 }}>
                <option value="">—</option>
                {(r.kind === "relation" ? relationOptions : r.kind === "role" ? roles : staff).map((o) => <Opt key={o.value} value={o.value}>{o.label}</Opt>)}
              </select>
              <button type="button" className="admin-btn small ghost" onClick={() => set(arr.filter((_, j) => j !== i))} aria-label="حذف">×</button>
            </div>
          ))}
          <button type="button" className="admin-btn small ghost" onClick={() => set([...arr, { kind: "relation", value: "assignee" }])}><Tx>+ مستلم</Tx></button>
        </div>
      );
    }
    default:
      return <input value={String(value ?? "")} placeholder={spec.placeholder} onChange={(e) => onChange(e.target.value || undefined)} />;
  }
}

// WHEN → IF → THEN builder with dry run (docs/bos/20).
export function WorkflowBuilder({ initial, staff, roles, canEdit }: { initial: RuleDraft; staff: Opt[]; roles: Opt[]; canEdit: boolean }) {
  const t = useT();
  const [rule, setRule] = useState<RuleDraft>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [samples, setSamples] = useState<{ id: number; summary: string; occurred_at: string }[]>([]);
  const [sample, setSample] = useState<string>("");
  const [dry, setDry] = useState<Awaited<ReturnType<typeof dryRunAction>> | null>(null);
  const [pending, start] = useTransition();
  const fields = eventMap.get(rule.trigger_event)?.fields ?? [];
  const set = (patch: Partial<RuleDraft>) => setRule((r) => ({ ...r, ...patch }));

  useEffect(() => {
    if (!canEdit) return;
    sampleEventsAction(rule.trigger_event).then((s) => {
      setSamples(s);
      setSample(s[0] ? String(s[0].id) : "");
    });
  }, [rule.trigger_event, canEdit]);

  const save = () =>
    start(async () => {
      setMsg(null);
      const r = await saveRuleAction(rule.id ?? null, JSON.stringify(rule));
      setMsg(r.ok ? { ok: true, text: r.message ?? "تم الحفظ" } : { ok: false, text: r.error });
    });
  const runDry = () =>
    start(async () => {
      if (!sample) return setMsg({ ok: false, text: "لا توجد أحداث سابقة من هذا النوع لاختبارها." });
      try {
        setDry(await dryRunAction(JSON.stringify(rule), Number(sample)));
      } catch (e) {
        setMsg({ ok: false, text: e instanceof Error ? e.message : "تعذر الاختبار" });
      }
    });

  return (
    <div className="bos-stack" style={{ gap: 14 }}>
      <div className="bos-card" style={{ padding: 14 }}>
        <div className="bos-form-grid">
          <div className="bos-field"><label><Tx>الاسم</Tx></label><input value={rule.name} onChange={(e) => set({ name: e.target.value })} disabled={!canEdit} /></div>
          <div className="bos-field"><label><Tx>الأولوية</Tx></label><input type="number" value={rule.priority} onChange={(e) => set({ priority: Number(e.target.value) })} disabled={!canEdit} /></div>
          <div className="bos-field" style={{ gridColumn: "1 / -1" }}><label><Tx>الوصف</Tx></label><textarea rows={2} value={rule.description ?? ""} onChange={(e) => set({ description: e.target.value })} disabled={!canEdit} /></div>
        </div>
        <label className="bos-check"><input type="checkbox" checked={rule.is_active} onChange={(e) => set({ is_active: e.target.checked })} disabled={!canEdit} /> <Tx>نشط</Tx></label>
        <label className="bos-check"><input type="checkbox" checked={rule.run_once_per_entity} onChange={(e) => set({ run_once_per_entity: e.target.checked })} disabled={!canEdit} /> <Tx>تشغيل مرة واحدة لكل سجل</Tx></label>
      </div>

      <div className="bos-card bos-wf-step" style={{ padding: 14 }}>
        <div className="bos-wf-label"><Tx>WHEN — عند</Tx></div>
        <select value={rule.trigger_event} onChange={(e) => set({ trigger_event: e.target.value })} disabled={!canEdit} style={{ minWidth: 280 }}>
          {eventGroups.map((g) => <optgroup key={g} label={t(g)}>{eventCatalog.filter((ev) => ev.group === g).map((ev) => <Opt key={ev.key} value={ev.key} suffix={ev.key}>{ev.label}</Opt>)}</optgroup>)}
        </select>
      </div>

      <div className="bos-card bos-wf-step" style={{ padding: 14 }}>
        <div className="bos-wf-label"><Tx>IF — إذا</Tx></div>
        <div className="bos-row" style={{ gap: 6, marginBottom: 8 }}>
          <span className="bos-faint" style={{ fontSize: 12.5 }}><Tx>تحقق</Tx></span>
          <select value={rule.condition_logic} onChange={(e) => set({ condition_logic: e.target.value as "all" | "any" })} disabled={!canEdit}><Opt value="all">كل الشروط</Opt><Opt value="any">أي شرط</Opt></select>
        </div>
        <datalist id="wf-fields">{fields.map((f) => <option key={f} value={f} />)}</datalist>
        {rule.conditions.map((c, i) => {
          const op = conditionOperators.find((o) => o.value === c.op);
          return (
            <div key={i} className="bos-row" style={{ gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
              <input list="wf-fields" value={c.field} placeholder={t("الحقل (مثل value_base أو entity.priority)")} dir="ltr" onChange={(e) => set({ conditions: rule.conditions.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)) })} disabled={!canEdit} style={{ flex: 2, minWidth: 180 }} />
              <select value={c.op} onChange={(e) => set({ conditions: rule.conditions.map((x, j) => (j === i ? { ...x, op: e.target.value as ConditionOperator } : x)) })} disabled={!canEdit}>{conditionOperators.map((o) => <Opt key={o.value} value={o.value}>{o.label}</Opt>)}</select>
              {op?.needsValue ? <input value={Array.isArray(c.value) ? (c.value as string[]).join(",") : String(c.value ?? "")} placeholder={["in", "not_in"].includes(c.op) ? "قيم مفصولة بفاصلة" : "القيمة"} dir="ltr" onChange={(e) => set({ conditions: rule.conditions.map((x, j) => (j === i ? { ...x, value: ["in", "not_in"].includes(x.op) ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : e.target.value } : x)) })} disabled={!canEdit} style={{ flex: 1, minWidth: 120 }} /> : null}
              {canEdit ? <button type="button" className="admin-btn small ghost" onClick={() => set({ conditions: rule.conditions.filter((_, j) => j !== i) })} aria-label="حذف">×</button> : null}
            </div>
          );
        })}
        {canEdit ? <button type="button" className="admin-btn small ghost" onClick={() => set({ conditions: [...rule.conditions, { field: fields[0] ?? "", op: "eq", value: "" }] })}><Tx>+ شرط</Tx></button> : null}
        {!rule.conditions.length ? <div className="bos-faint" style={{ fontSize: 12.5 }}><Tx>بدون شروط — يعمل مع كل حدث من هذا النوع.</Tx></div> : null}
      </div>

      <div className="bos-card bos-wf-step" style={{ padding: 14 }}>
        <div className="bos-wf-label"><Tx>THEN — نفّذ</Tx></div>
        {rule.actions.map((a, i) => {
          const spec = actionSpecs[a.type];
          return (
            <div key={i} className="bos-wf-action">
              <div className="bos-row" style={{ gap: 6, justifyContent: "space-between" }}>
                <div className="bos-row" style={{ gap: 6 }}>
                  <span className="bos-badge tone-info plain">{i + 1}</span>
                  <select value={a.type} onChange={(e) => set({ actions: rule.actions.map((x, j) => (j === i ? { type: e.target.value, params: {} } : x)) })} disabled={!canEdit}>{Object.entries(actionSpecs).map(([k, v]) => <Opt key={k} value={k}>{v.label}</Opt>)}</select>
                </div>
                {canEdit ? (
                  <span className="bos-row" style={{ gap: 4 }}>
                    <button type="button" className="admin-btn small ghost" disabled={i === 0} onClick={() => { const n = [...rule.actions]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; set({ actions: n }); }} aria-label="أعلى">↑</button>
                    <button type="button" className="admin-btn small ghost" disabled={i === rule.actions.length - 1} onClick={() => { const n = [...rule.actions]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; set({ actions: n }); }} aria-label="أسفل">↓</button>
                    <button type="button" className="admin-btn small ghost" onClick={() => set({ actions: rule.actions.filter((_, j) => j !== i) })} aria-label="حذف">×</button>
                  </span>
                ) : null}
              </div>
              <div className="bos-form-grid" style={{ marginTop: 8 }}>
                {(spec?.params ?? []).map((p) => (
                  <div key={p.key} className="bos-field">
                    <label><Tx>{p.label}</Tx></label>
                    {canEdit ? <ParamInput spec={p} value={a.params[p.key]} staff={staff} roles={roles} onChange={(v) => set({ actions: rule.actions.map((x, j) => (j === i ? { ...x, params: { ...x.params, [p.key]: v } } : x)) })} /> : <span className="bos-faint">{JSON.stringify(a.params[p.key] ?? "—")}</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {canEdit ? <button type="button" className="admin-btn small ghost" onClick={() => set({ actions: [...rule.actions, { type: "notify", params: { recipients: [{ kind: "relation", value: "assignee" }] } }] })}><Tx>+ إجراء</Tx></button> : null}
        <p className="bos-faint" style={{ fontSize: 12 }}>القوالب تقبل فقط {"{{payload.x}}"} و{"{{entity.x}}"} و{"{{summary}}"} — لا يُنفّذ أي كود.</p>
      </div>

      {canEdit ? (
        <div className="bos-card" style={{ padding: 14 }}>
          <div className="bos-row" style={{ gap: 8, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 13 }}><Tx>اختبار تجريبي على حدث حقيقي:</Tx></strong>
            <select value={sample} onChange={(e) => setSample(e.target.value)} style={{ minWidth: 260 }}>
              {samples.length ? samples.map((s) => <option key={s.id} value={s.id}>#{s.id} — {s.summary.slice(0, 70)}</option>) : <Opt value="">لا توجد أحداث سابقة</Opt>}
            </select>
            <button type="button" className="admin-btn small secondary" disabled={pending} onClick={runDry}><Tx>اختبار (بدون تنفيذ)</Tx></button>
            <button type="button" className="admin-btn small" disabled={pending} onClick={save}><Tx>{rule.id ? "حفظ" : "إنشاء"}</Tx></button>
          </div>
          {msg ? <div className={msg.ok ? "bos-form-success" : "bos-form-error"} style={{ marginTop: 8 }}><Tx>{msg.text}</Tx></div> : null}
          {dry ? (
            <div style={{ marginTop: 10, fontSize: 13 }}>
              <div><Tx vars={{ id: dry.event.id, type: dry.event.type, summary: dry.event.summary }}>{"الحدث #{id} ({type}): {summary}"}</Tx></div>
              {dry.conditions.map((c, i) => <div key={i}>{c.passed ? "✓" : "✗"} <span dir="ltr">{c.field} {c.op} {JSON.stringify(c.value ?? "")}</span></div>)}
              <div style={{ marginTop: 6, fontWeight: 700 }}>{dry.matched ? `سيُنفَّذ: ${dry.actions.map((a) => actionSpecs[a]?.label ?? a).join(" ← ")}` : "لن يُنفَّذ شيء — الشروط لم تتحقق."}</div>
              <details style={{ marginTop: 6 }}><summary className="bos-faint"><Tx>بيانات الحدث (payload)</Tx></summary><pre style={{ direction: "ltr", fontSize: 11.5, whiteSpace: "pre-wrap" }}>{JSON.stringify(dry.event.payload, null, 2)}</pre></details>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
