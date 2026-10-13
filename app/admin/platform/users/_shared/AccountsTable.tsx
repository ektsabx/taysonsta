"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Tx, useT } from "@/components/bos/I18n";
import { StatusBadge } from "@/components/bos/ui";
import { AccountStatus, SubscriptionState, money, segmentLabel, sourceLabel } from "@/components/yolias/AccountBits";
import { ACCOUNT_ACTIONS as ACTIONS, AccountActionDialog } from "./AccountActionDialog";
import type { AdminAccountRow } from "../../../../../Yolias/types/database";

// Users table with selection and bulk actions (D-214). Selection: rows on
// this page, or "every account matching the filters" (resolved again on the
// server, capped at 500). Sensitive actions ask for a confirmation; the
// result lists every account with success or the reason it failed.

export type AccountListRow = AdminAccountRow & { phone: string | null };


const dt = (v: string | null) => (v ? <bdi dir="ltr">{v.slice(0, 10)}</bdi> : "—");

export function AccountsTable({ rows, total, view, filters, canManage, smsConnected }: {
  rows: AccountListRow[]; total: number; view: string; filters: Record<string, string>; canManage: boolean; smsConnected: boolean;
}) {
  const t = useT();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [action, setAction] = useState<string>("");
  const [open, setOpen] = useState(false);
  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const count = allMatching ? total : selected.size;
  const emailOf = new Map(rows.map((r) => [r.id, r.email]));

  const toggle = (id: string) => {
    setAllMatching(false);
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <>
      {canManage && (
        <div className="bos-bulkbar" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "10px 12px", borderBottom: "1px solid var(--bos-line, #e5e7eb)" }}>
          <span className="bos-faint" style={{ fontSize: 13 }}>
            {count ? <Tx vars={{ n: count.toLocaleString("en-US") }}>{"تم تحديد {n} حساب"}</Tx> : <Tx>حدد حسابات لتنفيذ إجراء</Tx>}
          </span>
          {allOnPage && !allMatching && total > rows.length ? (
            <button type="button" className="admin-btn small ghost" onClick={() => setAllMatching(true)}>
              <Tx vars={{ n: total.toLocaleString("en-US") }}>{"تحديد كل النتائج المطابقة ({n})"}</Tx>
            </button>
          ) : null}
          {count ? <button type="button" className="admin-btn small ghost" onClick={() => { setSelected(new Set()); setAllMatching(false); }}><Tx>إلغاء التحديد</Tx></button> : null}
          <select aria-label={t("الإجراء")} value={action} onChange={(e) => setAction(e.target.value)} disabled={!count} style={{ marginInlineStart: "auto" }}>
            <option value="">{t("اختر إجراءً…")}</option>
            {ACTIONS.map((a) => <option key={a.key} value={a.key} disabled={a.key === "sms" && !smsConnected}>{t(a.label)}{a.key === "sms" && !smsConnected ? ` (${t("غير متصل")})` : ""}</option>)}
          </select>
          <button type="button" className="admin-btn small" disabled={!count || !action} onClick={() => setOpen(true)}><Tx>متابعة</Tx></button>
        </div>
      )}

      <div className="bos-table-scroll">
        <table className="bos-table responsive stacked">
          <thead>
            <tr>
              {canManage ? <th style={{ width: 32 }}><input type="checkbox" aria-label={t("تحديد الكل في هذه الصفحة")} checked={allOnPage} onChange={() => { setAllMatching(false); setSelected(allOnPage ? new Set() : new Set(pageIds)); }} /></th> : null}
              <th><Tx>المستخدم</Tx></th>
              <th><Tx>الحساب</Tx></th>
              <th><Tx>الاشتراك</Tx></th>
              <th><Tx>التجربة / الاشتراك</Tx></th>
              <th><Tx>المدفوعات</Tx></th>
              <th><Tx>آخر نشاط</Tx></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {canManage ? <td className="cell-check"><input type="checkbox" aria-label={r.email} checked={allMatching || selected.has(r.id)} onChange={() => toggle(r.id)} /></td> : null}
                <td data-label={t("المستخدم")} className="cell-main">
                  <Link href={`/admin/platform/users/${r.id}`} className="bos-link" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote avatar from Yolias storage */}
                    {r.avatar_url ? <img src={r.avatar_url} alt="" width={28} height={28} style={{ borderRadius: "50%", objectFit: "cover" }} /> : <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--bos-soft, #eef2f7)", display: "inline-grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>{(r.full_name || r.email).slice(0, 1).toUpperCase()}</span>}
                    <span>{r.full_name || "—"}</span>
                  </Link>
                  <span className="cell-sub" dir="ltr">{r.email}</span>
                  {r.phone ? <span className="cell-sub" dir="ltr">{r.phone}</span> : null}
                  <span className="cell-sub"><Tx vars={{ d: dt(r.created_at) }}>{"سجّل {d}"}</Tx>{r.country ? <> · <span dir="ltr">{r.country}</span></> : null}</span>
                </td>
                <td data-label={t("الحساب")}>
                  <AccountStatus value={r.account_status} until={r.status_until} />
                  <span className="cell-sub">{r.email_confirmed ? <Tx>البريد مؤكد</Tx> : <StatusBadge tone="warning" label="البريد غير مؤكد" />}</span>
                </td>
                <td data-label={t("الاشتراك")}>
                  <SubscriptionState {...r} />
                  <span className="cell-sub" dir="ltr">{r.plan}{r.billing_period ? ` · ${r.billing_period}` : ""}{r.billing_provider ? ` · ${r.billing_provider}` : ""}</span>
                  <span className="cell-sub"><Tx>{segmentLabel[r.segment] ?? r.segment}</Tx></span>
                </td>
                <td data-label={t("التجربة / الاشتراك")} style={{ whiteSpace: "nowrap" }}>
                  {r.trial_started_at ? <span className="cell-sub"><Tx vars={{ a: dt(r.trial_started_at), b: dt(r.trial_ends_at) }}>{"تجربة: {a} ← {b}"}</Tx></span> : null}
                  {r.current_period_end ? <span className="cell-sub"><Tx vars={{ d: dt(r.current_period_end) }}>{"ينتهي: {d}"}</Tx></span> : null}
                  {r.subscription_status === "active" ? <span className="cell-sub">{r.cancel_at_period_end ? <Tx>التجديد التلقائي: متوقف</Tx> : <Tx>التجديد التلقائي: مفعّل</Tx>}</span> : null}
                  {!r.trial_started_at && !r.current_period_end ? "—" : null}
                </td>
                <td data-label={t("المدفوعات")} className="bos-num">
                  {money(r.paid_total)}
                  {r.renewals ? <span className="cell-sub"><Tx vars={{ n: r.renewals }}>{"جدد {n} مرة"}</Tx></span> : null}
                  {r.last_payment_at ? <span className="cell-sub"><Tx vars={{ d: dt(r.last_payment_at) }}>{"آخر محاولة {d}"}</Tx> · {r.last_payment_status}</span> : null}
                </td>
                <td data-label={t("آخر نشاط")} style={{ whiteSpace: "nowrap" }}>
                  {dt(r.last_activity_at)}
                  <span className="cell-sub">{r.acquisition_source ? <Tx>{sourceLabel[r.acquisition_source] ?? r.acquisition_source}</Tx> : <Tx>المصدر غير مسجل</Tx>}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AccountActionDialog
        open={open} onClose={() => setOpen(false)} action={action} count={count}
        ids={[...selected]} all={allMatching ? { view, filters } : null} emailOf={emailOf}
      />
    </>
  );
}
