"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tx, useT } from "@/components/bos/I18n";
import { reviewTimeAction } from "./actions";

export function ApprovalQueue({ rows }: { rows: { id: string; who: string; project: string; task: string | null; when: string; hours: string; description: string | null; billable: boolean }[] }) {
  const t = useT();
  const router = useRouter();
  const [sel, setSel] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (d: "approved" | "rejected") => start(async () => { const r = await reviewTimeAction(sel, d, reason || null); setMsg(r.ok ? { ok: true, text: r.message ?? "تم" } : { ok: false, text: r.error }); if (r.ok) { setSel([]); setReason(""); } router.refresh(); });
  return (
    <div className="bos-stack" style={{ gap: 8 }}>
      <table className="bos-table">
        <thead><tr><th><input type="checkbox" checked={sel.length === rows.length && rows.length > 0} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.id) : [])} aria-label={t("تحديد الكل")} /></th><th><Tx>الموظف</Tx></th><th><Tx>المشروع / المهمة</Tx></th><th><Tx>التاريخ</Tx></th><th><Tx>الساعات</Tx></th><th><Tx>الوصف</Tx></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><input type="checkbox" checked={sel.includes(r.id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))} aria-label={r.who} /></td>
              <td>{r.who}</td>
              <td>{r.project}{r.task ? <div className="bos-faint" style={{ fontSize: 11.5 }}>{r.task}</div> : null}</td>
              <td className="bos-nowrap">{r.when}</td>
              <td className="bos-num">{r.hours}{r.billable ? <span className="bos-tag" style={{ marginInlineStart: 4 }}><Tx>قابل للفوترة</Tx></span> : null}</td>
              <td style={{ fontSize: 12 }}>{r.description ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="bos-row" style={{ gap: 6, flexWrap: "wrap", padding: "0 12px 12px" }}>
        <button type="button" className="admin-btn small" disabled={pending || !sel.length} onClick={() => run("approved")}><Tx>اعتماد المحدد</Tx></button>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("سبب الرفض")} style={{ minWidth: 200 }} />
        <button type="button" className="admin-btn small ghost" disabled={pending || !sel.length || !reason.trim()} onClick={() => run("rejected")}><Tx>رفض المحدد</Tx></button>
        {msg ? <span className={msg.ok ? "bos-faint" : "bos-danger"} style={{ fontSize: 12 }}>{t(msg.text)}</span> : null}
      </div>
    </div>
  );
}
