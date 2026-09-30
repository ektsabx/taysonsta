"use client";
import { BosTable } from "@/components/bos/BosTable";

import { Tx, Opt, useT } from "@/components/bos/I18n";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionButton, ModalButton } from "@/components/bos/Dialog";
import {
  addSubscriptionAction, archiveRoleAction, cloneRoleAction, deleteSubscriptionAction, saveRoleAction, savePipelineStagesAction,
  setRoleAppRequirementAction, setRolePermissionAction, setUserOverrideAction, testIntegrationAction, toggleSubscriptionAction,
} from "./actions";

type Opt = { value: string; label: string };
type Stage = { id: string | null; key: string; name: string; probability: number; category: "open" | "won" | "lost"; is_active: boolean };

export function StageEditor({ pipelineId, initial, entity }: { pipelineId: string; initial: Stage[]; entity: string }) {
  const [rows, setRows] = useState<Stage[]>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const upd = (i: number, patch: Partial<Stage>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= rows.length) return; const n = [...rows]; [n[i], n[j]] = [n[j], n[i]]; setRows(n); };
  return (
    <div>
      <BosTable className="bos-table">
        <thead><tr><th /><th><Tx>المفتاح</Tx></th><th><Tx>الاسم</Tx></th><th><Tx>الاحتمالية %</Tx></th><th><Tx>الفئة</Tx></th><th><Tx>نشطة</Tx></th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? `new-${i}`} style={r.is_active ? undefined : { opacity: 0.55 }}>
              <td style={{ whiteSpace: "nowrap" }}><button type="button" className="admin-btn small ghost" onClick={() => move(i, -1)} aria-label="أعلى">↑</button><button type="button" className="admin-btn small ghost" onClick={() => move(i, 1)} aria-label="أسفل">↓</button></td>
              <td><input value={r.key} dir="ltr" onChange={(e) => upd(i, { key: e.target.value })} disabled={!!r.id} style={{ width: 130 }} /></td>
              <td><input value={r.name} onChange={(e) => upd(i, { name: e.target.value })} /></td>
              <td><input type="number" min={0} max={100} value={r.probability} onChange={(e) => upd(i, { probability: Number(e.target.value) })} style={{ width: 80 }} /></td>
              <td><select value={r.category} onChange={(e) => upd(i, { category: e.target.value as Stage["category"] })}><Opt value="open">مفتوحة</Opt><Opt value="won">مكسوبة</Opt><Opt value="lost">خاسرة</Opt></select></td>
              <td><input type="checkbox" checked={r.is_active} onChange={(e) => upd(i, { is_active: e.target.checked })} /></td>
              <td>{!r.id ? <button type="button" className="admin-btn small ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))}>×</button> : null}</td>
            </tr>
          ))}
        </tbody>
      </BosTable>
      <p className="bos-faint" style={{ fontSize: 12 }}>{entity === "deal" ? "يجب وجود مرحلة مفتوحة واحدة على الأقل، ومرحلة «مكسوبة» واحدة و«خاسرة» واحدة بالضبط." : "يجب وجود مرحلة مفتوحة واحدة على الأقل."} المراحل المستخدمة تُعطّل بدلاً من الحذف.</p>
      <div className="bos-row" style={{ gap: 6 }}>
        <button type="button" className="admin-btn small ghost" onClick={() => setRows([...rows, { id: null, key: "", name: "", probability: 0, category: "open", is_active: true }])}><Tx>+ مرحلة</Tx></button>
        <button type="button" className="admin-btn small" disabled={pending} onClick={() => start(async () => { const r = await savePipelineStagesAction(pipelineId, JSON.stringify(rows)); setMsg(r.ok ? { ok: true, text: r.message ?? "تم" } : { ok: false, text: r.error }); router.refresh(); })}><Tx>حفظ المراحل</Tx></button>
      </div>
      {msg ? <div className={msg.ok ? "bos-form-success" : "bos-form-error"} style={{ marginTop: 6 }}><Tx>{msg.text}</Tx></div> : null}
    </div>
  );
}

export function RoleForm({ id, initial, label }: { id: string | null; initial?: { key: string; name: string; description: string | null; sort_order: number; is_system?: boolean }; label: string }) {
  const [v, setV] = useState(initial ?? { key: "", name: "", description: "", sort_order: 50 });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <ModalButton label={label} title={id ? "تعديل الدور" : "دور جديد"} className={id ? "admin-btn small ghost" : "admin-btn small"}>
      {(close) => (
        <div>
          <div className="bos-form-grid">
            <div className="bos-field"><label><Tx>المفتاح</Tx></label><input dir="ltr" value={v.key} disabled={!!initial?.is_system} onChange={(e) => setV({ ...v, key: e.target.value })} /></div>
            <div className="bos-field"><label><Tx>الاسم</Tx></label><input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
            <div className="bos-field"><label><Tx>الترتيب</Tx></label><input type="number" value={v.sort_order} onChange={(e) => setV({ ...v, sort_order: Number(e.target.value) })} /></div>
            <div className="bos-field" style={{ gridColumn: "1 / -1" }}><label><Tx>الوصف</Tx></label><textarea rows={2} value={v.description ?? ""} onChange={(e) => setV({ ...v, description: e.target.value })} /></div>
          </div>
          {err ? <div className="bos-form-error"><Tx>{err}</Tx></div> : null}
          <div className="bos-form-actions"><button type="button" className="admin-btn" disabled={pending} onClick={() => start(async () => { const r = await saveRoleAction(id, JSON.stringify(v)); if (r.ok) { close(); router.refresh(); } else setErr(r.error); })}><Tx>حفظ</Tx></button></div>
        </div>
      )}
    </ModalButton>
  );
}

export function CloneRoleButton({ id, name }: { id: string; name: string }) {
  const [key, setKey] = useState("");
  const [n, setN] = useState(`${name} (نسخة)`);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <ModalButton label="نسخ" title="نسخ الدور مع صلاحياته" className="admin-btn small ghost">
      {(close) => (
        <div>
          <div className="bos-field"><label><Tx>المفتاح الجديد</Tx></label><input dir="ltr" value={key} onChange={(e) => setKey(e.target.value)} /></div>
          <div className="bos-field"><label><Tx>الاسم</Tx></label><input value={n} onChange={(e) => setN(e.target.value)} /></div>
          {err ? <div className="bos-form-error"><Tx>{err}</Tx></div> : null}
          <div className="bos-form-actions"><button type="button" className="admin-btn" disabled={pending} onClick={() => start(async () => { const r = await cloneRoleAction(id, key, n); if (r.ok) { close(); router.refresh(); } else setErr(r.error); })}><Tx>نسخ</Tx></button></div>
        </div>
      )}
    </ModalButton>
  );
}

export function ArchiveRoleButton({ id, archived }: { id: string; archived: boolean }) {
  return <ActionButton label={archived ? "استعادة" : "أرشفة"} className="admin-btn small ghost" action={() => archiveRoleAction(id, !archived)} />;
}

const scopes = [{ value: "", label: "—" }, { value: "own", label: "خاص" }, { value: "assigned", label: "المسند" }, { value: "team", label: "الفريق" }, { value: "all", label: "الكل" }];

export function ScopeCell({ roleId, permissionId, scope, disabled }: { roleId: string; permissionId: string; scope: string | null; disabled?: boolean }) {
  const t = useT();
  const [v, setV] = useState(scope ?? "");
  const [pending, start] = useTransition();
  return (
    <select aria-label={t("النطاق")} value={v} disabled={disabled || pending} className={v ? "bos-scope-on" : undefined} onChange={(e) => { const nv = e.target.value; setV(nv); start(async () => { const r = await setRolePermissionAction(roleId, permissionId, nv); if (!r.ok) { alert(r.error); setV(scope ?? ""); } }); }}>
      {scopes.map((s) => <Opt key={s.value} value={s.value}>{s.label}</Opt>)}
    </select>
  );
}

export function OverrideForm({ users, permissions }: { users: Opt[]; permissions: Opt[] }) {
  const t = useT();
  const [v, setV] = useState({ user: "", perm: "", effect: "grant", scope: "own", reason: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
      <select value={v.user} onChange={(e) => setV({ ...v, user: e.target.value })}><Opt value="">المستخدم...</Opt>{users.map((u) => <Opt key={u.value} value={u.value}>{u.label}</Opt>)}</select>
      <select value={v.perm} onChange={(e) => setV({ ...v, perm: e.target.value })} style={{ maxWidth: 220 }}><Opt value="">الصلاحية...</Opt>{permissions.map((p) => <Opt key={p.value} value={p.value}>{p.label}</Opt>)}</select>
      <select value={v.effect} onChange={(e) => setV({ ...v, effect: e.target.value })}><Opt value="grant">منح</Opt><Opt value="deny">منع</Opt></select>
      {v.effect === "grant" ? <select value={v.scope} onChange={(e) => setV({ ...v, scope: e.target.value })}>{scopes.slice(1).map((s) => <Opt key={s.value} value={s.value}>{s.label}</Opt>)}</select> : null}
      <input placeholder={t("السبب (إلزامي)")} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} />
      <button type="button" className="admin-btn small" disabled={pending || !v.user || !v.perm} onClick={() => start(async () => { const r = await setUserOverrideAction(v.user, v.perm, v.effect, v.scope, v.reason); setMsg(r.ok ? "تم" : r.error); router.refresh(); })}><Tx>حفظ الاستثناء</Tx></button>
      {msg ? <span className="bos-faint" style={{ fontSize: 12 }}><Tx>{msg}</Tx></span> : null}
    </div>
  );
}

export function RemoveOverrideButton({ userId, permissionId }: { userId: string; permissionId: string }) {
  return <ActionButton label="إزالة" className="admin-btn small ghost" action={() => setUserOverrideAction(userId, permissionId, "", "", "")} />;
}

export function SubscriptionRowControls({ id, active }: { id: string; active: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <span className="bos-row" style={{ gap: 4 }}>
      <input type="checkbox" checked={active} disabled={pending} aria-label={t("نشط")} onChange={(e) => start(async () => { await toggleSubscriptionAction(id, e.target.checked); router.refresh(); })} />
      <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => { if (confirm("حذف الاشتراك؟")) start(async () => { await deleteSubscriptionAction(id); router.refresh(); }); }}>×</button>
    </span>
  );
}

export function AddSubscriptionForm({ events, roles, users, relations }: { events: Opt[]; roles: Opt[]; users: Opt[]; relations: Opt[] }) {
  const [v, setV] = useState({ event_type: events[0]?.value ?? "", kind: "relation", value: "assignee", channels: ["in_app"], user_configurable: true });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const opts = v.kind === "role" ? roles : v.kind === "user" ? users : relations;
  return (
    <div className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
      <select value={v.event_type} onChange={(e) => setV({ ...v, event_type: e.target.value })} style={{ maxWidth: 260 }}>{events.map((e) => <Opt key={e.value} value={e.value} suffix={e.value}>{e.label}</Opt>)}</select>
      <select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value, value: "" })}><Opt value="relation">علاقة</Opt><Opt value="role">دور</Opt><Opt value="user">شخص</Opt></select>
      <select value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })}><option value="">—</option>{opts.map((o) => <Opt key={o.value} value={o.value}>{o.label}</Opt>)}</select>
      {["in_app", "email", "push"].map((c) => <label key={c} className="bos-check"><input type="checkbox" checked={v.channels.includes(c)} onChange={(e) => setV({ ...v, channels: e.target.checked ? [...v.channels, c] : v.channels.filter((x) => x !== c) })} /><Tx>{c === "in_app" ? "داخلي" : c === "email" ? "بريد" : "Push"}</Tx></label>)}
      <label className="bos-check"><input type="checkbox" checked={v.user_configurable} onChange={(e) => setV({ ...v, user_configurable: e.target.checked })} /><Tx>قابل للتخصيص</Tx></label>
      <button type="button" className="admin-btn small" disabled={pending || !v.value} onClick={() => start(async () => { const r = await addSubscriptionAction(JSON.stringify(v)); setMsg(r.ok ? "تمت الإضافة" : r.error); router.refresh(); })}><Tx>+ اشتراك</Tx></button>
      {msg ? <span className="bos-faint" style={{ fontSize: 12 }}><Tx>{msg}</Tx></span> : null}
    </div>
  );
}

export function TestIntegrationButton({ name }: { name: string }) {
  return <ActionButton label="اختبار الاتصال" className="admin-btn small ghost" action={() => testIntegrationAction(name)} />;
}

export function RequirementCell({ roleId, appId, required, level, levels }: { roleId: string; appId: string; required: boolean; level: string | null; levels: string[] }) {
  const t = useT();
  const [on, setOn] = useState(required);
  const [lv, setLv] = useState(level ?? "");
  const [pending, start] = useTransition();
  const save = (r: boolean, l: string) => start(async () => { const res = await setRoleAppRequirementAction(roleId, appId, r, l); if (!res.ok) alert(res.error); });
  return (
    <span className="bos-row" style={{ gap: 4 }}>
      <input type="checkbox" checked={on} disabled={pending} aria-label={t("مطلوب")} onChange={(e) => { setOn(e.target.checked); save(e.target.checked, lv); }} />
      {on && levels.length ? <select value={lv} disabled={pending} onChange={(e) => { setLv(e.target.value); save(true, e.target.value); }} style={{ fontSize: 11 }}><option value="">—</option>{levels.map((l) => <option key={l} value={l}>{l}</option>)}</select> : null}
    </span>
  );
}
