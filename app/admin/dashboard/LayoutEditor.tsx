"use client";

import { Tx, useT } from "@/components/bos/I18n";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetDashboardLayoutAction, saveDashboardLayoutAction } from "./actions";

type W = { key: string; title: string; dashboard: string };
const dashLabels: Record<string, string> = { employee: "الموظف", bd: "المبيعات", pm: "المشاريع", finance: "المالية", executive: "التنفيذي" };

export function LayoutEditor({ roleId, available, initial }: { roleId: string | null; available: W[]; initial: string[] }) {
  const tr = useT();
  const [keys, setKeys] = useState(initial.filter((k) => available.some((a) => a.key === k)));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const title = (k: string) => tr(available.find((a) => a.key === k)?.title ?? k);
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= keys.length) return; const n = [...keys]; [n[i], n[j]] = [n[j], n[i]]; setKeys(n); };
  const unused = available.filter((a) => !keys.includes(a.key));
  return (
    <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
      <div className="bos-card" style={{ padding: 14 }}>
        <strong><Tx>العناصر المعروضة (بالترتيب)</Tx></strong>
        <ol style={{ paddingInlineStart: 20 }}>
          {keys.map((k, i) => (
            <li key={k} className="bos-row" style={{ justifyContent: "space-between", padding: "4px 0" }}>
              <span>{title(k)}</span>
              <span className="bos-row" style={{ gap: 2 }}>
                <button type="button" className="admin-btn small ghost" onClick={() => move(i, -1)} aria-label="أعلى">↑</button>
                <button type="button" className="admin-btn small ghost" onClick={() => move(i, 1)} aria-label="أسفل">↓</button>
                <button type="button" className="admin-btn small ghost" onClick={() => setKeys(keys.filter((x) => x !== k))} aria-label="إخفاء">×</button>
              </span>
            </li>
          ))}
        </ol>
        <div className="bos-row" style={{ gap: 6 }}>
          <button type="button" className="admin-btn small" disabled={pending} onClick={() => start(async () => { const r = await saveDashboardLayoutAction(roleId, keys); setMsg(r.ok ? { ok: true, text: r.message ?? "تم" } : { ok: false, text: r.error }); router.refresh(); })}><Tx>حفظ</Tx></button>
          <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => start(async () => { const r = await resetDashboardLayoutAction(roleId); setMsg(r.ok ? { ok: true, text: r.message ?? "تم" } : { ok: false, text: r.error }); router.refresh(); })}><Tx>استعادة الافتراضي</Tx></button>
        </div>
        {msg ? <div className={msg.ok ? "bos-form-success" : "bos-form-error"} style={{ marginTop: 6 }}><Tx>{msg.text}</Tx></div> : null}
      </div>
      <div className="bos-card" style={{ padding: 14 }}>
        <strong><Tx>عناصر متاحة</Tx></strong>
        {Object.keys(dashLabels).map((d) => {
          const items = unused.filter((u) => u.dashboard === d);
          if (!items.length) return null;
          return (
            <div key={d} style={{ marginTop: 8 }}>
              <div className="bos-faint" style={{ fontSize: 12 }}><Tx>{dashLabels[d]}</Tx></div>
              {items.map((u) => <button key={u.key} type="button" className="admin-btn small ghost" style={{ margin: 2 }} onClick={() => setKeys([...keys, u.key])}>+ {tr(u.title)}</button>)}
            </div>
          );
        })}
        {!unused.length ? <div className="bos-faint" style={{ fontSize: 13 }}><Tx>كل العناصر معروضة.</Tx></div> : null}
      </div>
    </div>
  );
}
