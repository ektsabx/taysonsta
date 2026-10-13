"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/bos/Dialog";
import { Tx, useT } from "@/components/bos/I18n";
import { StatusBadge } from "@/components/bos/ui";
import type { ActionState } from "@/lib/bos/action";
import { checkoutBulkAction, type CheckoutBulkResult } from "../actions";
import { CheckoutStatus, since } from "./CheckoutBits";
import type { CheckoutSessionRow } from "../../../../../Yolias/types/database";

// Abandoned checkouts table (D-212): last step, payment state and time since
// the last activity come first; selection + follow-up actions (never automatic).

export type CheckoutListRow = CheckoutSessionRow & {
  user: { id: string; email: string; full_name: string | null } | null;
  phone: string | null;
  subscribedNow: boolean;
  hadTrial: boolean;
  next: string;
};

const ACTIONS = [
  { key: "email", label: "إرسال بريد لاستكمال الاشتراك" },
  { key: "in_app", label: "إرسال إشعار داخل التطبيق" },
  { key: "sms", label: "إرسال SMS" },
  { key: "note", label: "إضافة ملاحظة داخلية" },
  { key: "assign", label: "تعيين لمسؤول" },
  { key: "reviewed", label: "تحديد كتمت مراجعتها" },
  { key: "excluded", label: "استبعاد من المتابعة" },
  { key: "new", label: "إرجاع إلى «جديد»" },
];

export function CheckoutsTable({ rows, total, filters, canManage, labels }: {
  rows: CheckoutListRow[]; total: number; filters: Record<string, string>; canManage: boolean;
  labels: { steps: Record<string, string>; reasons: Record<string, string>; providers: Record<string, string> };
}) {
  const t = useT();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [action, setAction] = useState("");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState<CheckoutBulkResult>, FormData>(checkoutBulkAction, { ok: true });
  const [submitted, setSubmitted] = useState(false);
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const allOnPage = ids.length > 0 && ids.every((i) => selected.has(i));
  const count = allMatching ? total : selected.size;
  const label = ACTIONS.find((a) => a.key === action)?.label ?? "";
  const who = new Map(rows.map((r) => [r.id, r.user?.email ?? t("زائر مجهول")]));
  useEffect(() => { if (submitted && state.ok) router.refresh(); }, [state, submitted, router]);
  const dt = (v: string | null) => (v ? <bdi dir="ltr">{v.slice(0, 16).replace("T", " ")}</bdi> : "—");

  return (
    <>
      {canManage && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "10px 12px", borderBottom: "1px solid var(--bos-line, #e5e7eb)" }}>
          <span className="bos-faint" style={{ fontSize: 13 }}>{count ? <Tx vars={{ n: count }}>{"تم تحديد {n} حالة"}</Tx> : <Tx>حدد حالات لاتخاذ إجراء</Tx>}</span>
          {allOnPage && !allMatching && total > rows.length ? <button type="button" className="admin-btn small ghost" onClick={() => setAllMatching(true)}><Tx vars={{ n: total }}>{"تحديد كل النتائج ({n})"}</Tx></button> : null}
          <select aria-label={t("الإجراء")} value={action} onChange={(e) => setAction(e.target.value)} disabled={!count} style={{ marginInlineStart: "auto" }}>
            <option value="">{t("اختر إجراءً…")}</option>
            {ACTIONS.map((a) => <option key={a.key} value={a.key} disabled={a.key === "sms"}>{t(a.label)}{a.key === "sms" ? ` (${t("غير متصل")})` : ""}</option>)}
          </select>
          <button type="button" className="admin-btn small" disabled={!count || !action} onClick={() => { setSubmitted(false); setOpen(true); }}><Tx>متابعة</Tx></button>
        </div>
      )}
      <div className="bos-table-scroll">
        <table className="bos-table responsive stacked">
          <thead>
            <tr>
              {canManage ? <th style={{ width: 32 }}><input type="checkbox" aria-label={t("تحديد الكل في هذه الصفحة")} checked={allOnPage} onChange={() => { setAllMatching(false); setSelected(allOnPage ? new Set() : new Set(ids)); }} /></th> : null}
              <th><Tx>المستخدم</Tx></th>
              <th><Tx>آخر خطوة والحالة</Tx></th>
              <th><Tx>الخطة والبوابة</Tx></th>
              <th><Tx>السبب</Tx></th>
              <th><Tx>الإجراء المقترح</Tx></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {canManage ? <td className="cell-check"><input type="checkbox" aria-label={r.id} checked={allMatching || selected.has(r.id)} onChange={() => { setAllMatching(false); setSelected((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; }); }} /></td> : null}
                <td data-label={t("المستخدم")} className="cell-main">
                  {r.user ? <Link className="bos-link" href={`/admin/platform/users/${r.user.id}`}>{r.user.full_name || r.user.email}</Link> : <StatusBadge tone="neutral" label="زائر مجهول" />}
                  {r.user ? <span className="cell-sub" dir="ltr">{r.user.email}</span> : null}
                  {r.phone ? <span className="cell-sub" dir="ltr">{r.phone}</span> : null}
                  <span className="cell-sub"><Link className="bos-link" href={`/admin/platform/conversions/abandoned/${r.id}`}><Tx>تفاصيل Checkout</Tx></Link></span>
                </td>
                <td data-label={t("آخر خطوة والحالة")}>
                  <CheckoutStatus c={r} />
                  <span className="cell-sub"><Tx>{labels.steps[r.last_step] ?? r.last_step}</Tx> · <Tx vars={{ t: since(r.last_activity_at) }}>{"منذ {t}"}</Tx></span>
                  <span className="cell-sub">{r.redirected_at ? <Tx>انتقل للبوابة</Tx> : <Tx>لم ينتقل للبوابة</Tx>} · {r.returned_at ? <Tx>عاد للموقع</Tx> : <Tx>لم يعد</Tx>}</span>
                  <span className="cell-sub" dir="ltr">{dt(r.opened_at)}</span>
                </td>
                <td data-label={t("الخطة والبوابة")}>
                  <span dir="ltr">{r.plan ?? "—"} · {r.billing_period ?? ""}</span>
                  <span className="cell-sub" dir="ltr">{r.amount_usd != null ? `${r.currency} ${Number(r.amount_usd)}` : "—"}</span>
                  <span className="cell-sub">{r.provider ? <Tx>{labels.providers[r.provider] ?? r.provider}</Tx> : <Tx>لم يختر بعد</Tx>} · <Tx vars={{ n: r.attempts }}>{"{n} محاولة"}</Tx></span>
                </td>
                <td data-label={t("السبب")}>
                  {r.reason_category ? <Tx>{labels.reasons[r.reason_category] ?? r.reason_category}</Tx> : "—"}
                  {r.failure_reason ? <span className="cell-sub">{r.failure_reason}</span> : null}
                  <span className="cell-sub">{r.subscribedNow ? <Tx>مشترك الآن</Tx> : <Tx>لم يشترك</Tx>}{r.hadTrial ? <> · <Tx>لديه تجربة</Tx></> : null}</span>
                </td>
                <td data-label={t("الإجراء المقترح")} style={{ fontSize: 12.5 }}>
                  <Tx>{r.next}</Tx>
                  {r.review_status !== "new" ? <span className="cell-sub">{r.review_status === "excluded" ? <Tx>مستبعد</Tx> : <Tx>تمت المراجعة</Tx>}{r.reviewed_by ? ` · ${r.reviewed_by}` : ""}</span> : null}
                  {r.assigned_to ? <span className="cell-sub"><Tx vars={{ n: r.assigned_to }}>{"مُعيَّن لـ {n}"}</Tx></span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={label} wide>
        <form className="bos-form" action={(fd) => { setSubmitted(true); return formAction(fd); }}>
          <input type="hidden" name="action" value={action} />
          {allMatching ? (<><input type="hidden" name="all" value="1" /><input type="hidden" name="filters" value={JSON.stringify(filters)} /></>) : [...selected].map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
          <p style={{ fontSize: 13.5 }}><Tx vars={{ n: count }}>{"سيُطبَّق على {n} حالة."}</Tx></p>
          {(action === "email" || action === "in_app") && (
            <>
              <div className="bos-field"><label htmlFor="c-subject"><Tx>العنوان</Tx></label><input id="c-subject" name="subject" required maxLength={200} defaultValue="Complete your Yolias subscription" /></div>
              <div className="bos-field"><label htmlFor="c-body"><Tx>النص</Tx></label><textarea id="c-body" name="body" rows={5} required maxLength={5000} defaultValue={"You started subscribing to Yolias but didn't finish. Your plan is one step away: open the link below to pick up where you left off.\n\nIf something went wrong with the payment, reply to this email and we'll help."} /></div>
              <p className="bos-faint" style={{ fontSize: 12.5 }}><Tx>يُرسل للمستخدمين المعروفين فقط، برابط جديد لصفحة الدفع (لا يُعاد إرسال رابط دفع منتهٍ)، ولا يُرسل لمن اشترك بالفعل أو أوقف «تحديثات المنتج»، ولا تتكرر نفس الرسالة خلال 24 ساعة. إرسال الرسالة لا يعني استعادة الاشتراك.</Tx></p>
              {count > 20 && <div className="bos-field"><label htmlFor="c-confirm"><Tx>اكتب SEND للتأكيد</Tx></label><input id="c-confirm" name="confirm" dir="ltr" required /></div>}
            </>
          )}
          {action === "note" && <div className="bos-field"><label htmlFor="c-note"><Tx>الملاحظة (لا تظهر للمستخدم)</Tx></label><textarea id="c-note" name="body" rows={4} required maxLength={4000} /></div>}
          {action === "assign" && <div className="bos-field"><label htmlFor="c-assignee"><Tx>اسم المسؤول (اتركه فارغًا لإلغاء التعيين)</Tx></label><input id="c-assignee" name="assignee" maxLength={120} /></div>}
          {action === "excluded" && <div className="bos-field"><label htmlFor="c-reason"><Tx>سبب الاستبعاد</Tx></label><textarea id="c-reason" name="reason" rows={2} required minLength={3} maxLength={300} /></div>}
          <div className="bos-row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="admin-btn ghost" onClick={() => setOpen(false)}><Tx>إغلاق</Tx></button>
            <button type="submit" className="admin-btn" disabled={pending} aria-busy={pending}>{t(pending ? "جارٍ التنفيذ..." : "تأكيد")}</button>
          </div>
          {submitted && !state.ok ? <div className="bos-form-error" role="alert">{t(state.error)}</div> : null}
          {submitted && state.ok && state.data ? (
            <div className="bos-stack" style={{ gap: 6 }}>
              <div className="bos-form-success" role="status">{t(state.message ?? "")}</div>
              <div style={{ maxHeight: 220, overflow: "auto" }}>
                <table className="bos-table"><tbody>{state.data.results.map((r) => (
                  <tr key={r.id}><td dir="ltr" style={{ fontSize: 12 }}>{r.email ?? who.get(r.id) ?? r.id}</td><td>{r.ok ? <StatusBadge tone="success" label="تم" /> : <StatusBadge tone="danger" label="لم يُنفذ" />}</td><td style={{ fontSize: 12 }}>{r.error ? t(r.error) : ""}</td></tr>
                ))}</tbody></table>
              </div>
            </div>
          ) : null}
        </form>
      </Modal>
    </>
  );
}
