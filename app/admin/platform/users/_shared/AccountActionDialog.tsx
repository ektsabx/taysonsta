"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/bos/Dialog";
import { Tx, useT } from "@/components/bos/I18n";
import { StatusBadge } from "@/components/bos/ui";
import type { ActionState } from "@/lib/bos/action";
import { bulkAccountAction, type BulkResult } from "../actions";

// The dialog behind every Users action (table bulk bar and User 360, D-214).
// Sensitive actions need a reason and, for deletes / large sends, a typed
// confirmation; the server checks the same rules again.

export const ACCOUNT_ACTIONS: { key: string; label: string; danger?: boolean; needsReason?: boolean }[] = [
  { key: "email", label: "إرسال بريد إلكتروني" },
  { key: "in_app", label: "إرسال إشعار داخل التطبيق" },
  { key: "sms", label: "إرسال SMS" },
  { key: "note", label: "إضافة ملاحظة داخلية" },
  { key: "compensate", label: "إضافة رصيد / تعويض", needsReason: true },
  { key: "renewal_request", label: "إرسال طلب تجديد" },
  { key: "pause", label: "إيقاف مؤقت", danger: true, needsReason: true },
  { key: "suspend", label: "إيقاف الحساب", danger: true, needsReason: true },
  { key: "restore", label: "إعادة تفعيل الحساب" },
  { key: "ban", label: "حظر الحساب", danger: true, needsReason: true },
  { key: "unban", label: "رفع الحظر" },
  { key: "delete", label: "حذف الحساب", danger: true, needsReason: true },
];

export function AccountActionDialog({ open, onClose, action, count, ids, all, emailOf }: {
  open: boolean; onClose: () => void; action: string; count: number; ids: string[];
  all: { view: string; filters: Record<string, string> } | null; emailOf?: Map<string, string>;
}) {
  const t = useT();
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionState<BulkResult>, FormData>(bulkAccountAction, { ok: true });
  const [submitted, setSubmitted] = useState(false);
  const def = ACCOUNT_ACTIONS.find((a) => a.key === action);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setSubmitted(false);
  }
  useEffect(() => {
    if (submitted && state.ok) router.refresh();
  }, [state, submitted, router]);

  return (
      <Modal open={open} onClose={onClose} title={def?.label ?? "إجراء"} wide>
        <form
          className="bos-form"
          action={(fd) => {
            setSubmitted(true);
            return formAction(fd);
          }}
        >
          <input type="hidden" name="action" value={action} />
          {all ? (
            <>
              <input type="hidden" name="all" value="1" />
              <input type="hidden" name="view" value={all.view} />
              <input type="hidden" name="filters" value={JSON.stringify(all.filters)} />
            </>
          ) : ids.map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
          <p style={{ fontSize: 13 }}>
            <Tx vars={{ n: count.toLocaleString("en-US") }}>{"سيُطبَّق الإجراء على {n} حساب."}</Tx>
            {def?.danger ? <> <strong><Tx>إجراء حساس: راجع التحديد قبل التأكيد.</Tx></strong></> : null}
          </p>
          {(action === "email" || action === "in_app" || action === "sms" || action === "renewal_request") && (
            <>
              {action !== "renewal_request" && (
                <div className="bos-field">
                  <label htmlFor="purpose"><Tx>نوع الرسالة</Tx></label>
                  <select id="purpose" name="purpose" defaultValue="service">
                    <option value="service">{t("خدمة (تُرسل دائمًا)")}</option>
                    <option value="recovery">{t("استكمال الاشتراك (تحترم إيقاف «تحديثات المنتج»)")}</option>
                    <option value="marketing">{t("تسويقية (تحترم إيقاف «تحديثات المنتج»)")}</option>
                  </select>
                </div>
              )}
              <div className="bos-field"><label htmlFor="subject"><Tx>العنوان</Tx></label><input id="subject" name="subject" maxLength={200} required={action !== "renewal_request"} placeholder={action === "renewal_request" ? "Renew your Yolias plan" : ""} /></div>
              <div className="bos-field"><label htmlFor="body"><Tx>النص</Tx></label><textarea id="body" name="body" rows={5} maxLength={5000} required={action !== "renewal_request"} /></div>
              {action !== "renewal_request" && <div className="bos-field"><label htmlFor="cta_url"><Tx>رابط داخل يولياس (اختياري، يبدأ بـ /)</Tx></label><input id="cta_url" name="cta_url" dir="ltr" placeholder="/checkout" /></div>}
              {action === "renewal_request" && <p className="bos-faint" style={{ fontSize: 12.5 }}><Tx>يرسل بريدًا برابط صفحة الدفع على نفس الخطة. لا يُفعَّل أي اشتراك إلا بعد دفع ناجح.</Tx></p>}
              <p className="bos-faint" style={{ fontSize: 12.5 }}><Tx>البريد يُكتب ويُرسل بالإنجليزية كما تكتبه. لا تُرسل نفس الرسالة لنفس الحساب أكثر من مرة خلال 24 ساعة، ولا تُرسل لحساب محذوف.</Tx></p>
              {count > 20 && <div className="bos-field"><label htmlFor="confirm"><Tx>اكتب SEND للتأكيد</Tx></label><input id="confirm" name="confirm" dir="ltr" required /></div>}
            </>
          )}
          {action === "note" && <div className="bos-field"><label htmlFor="body"><Tx>الملاحظة (لا تظهر للمستخدم)</Tx></label><textarea id="body" name="body" rows={4} maxLength={4000} required /></div>}
          {action === "compensate" && (
            <div className="bos-field"><label htmlFor="prospects"><Tx>عدد العملاء المحتملين المضافين لهذا الشهر</Tx></label><input id="prospects" name="prospects" type="number" min={1} max={100000} required /></div>
          )}
          {action === "pause" && <div className="bos-field"><label htmlFor="days"><Tx>المدة بالأيام</Tx></label><input id="days" name="days" type="number" min={1} max={365} defaultValue={7} required /></div>}
          {def?.needsReason && <div className="bos-field"><label htmlFor="reason"><Tx>السبب (يُسجَّل في سجل التدقيق)</Tx></label><textarea id="reason" name="reason" rows={2} minLength={3} maxLength={300} required /></div>}
          {action === "delete" && (
            <>
              <p className="bos-faint" style={{ fontSize: 12.5 }}><Tx>الحذف يوقف الدخول ويحرر البريد، ويحتفظ بالمدفوعات والفواتير وسجل التدقيق كما يتطلب القانون والمحاسبة.</Tx></p>
              <div className="bos-field"><label htmlFor="confirm"><Tx>اكتب DELETE للتأكيد</Tx></label><input id="confirm" name="confirm" dir="ltr" required /></div>
            </>
          )}
          <div className="bos-row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="admin-btn ghost" onClick={onClose}><Tx>إغلاق</Tx></button>
            <button type="submit" className={def?.danger ? "admin-btn danger" : "admin-btn"} disabled={pending} aria-busy={pending}>{t(pending ? "جارٍ التنفيذ..." : "تأكيد")}</button>
          </div>
          {submitted && !state.ok ? <div className="bos-form-error" role="alert">{t(state.error)}</div> : null}
          {submitted && state.ok && state.data ? (
            <div className="bos-stack" style={{ gap: 6 }}>
              <div className="bos-form-success" role="status">{t(state.message ?? "")}</div>
              <div style={{ maxHeight: 240, overflow: "auto" }}>
                <table className="bos-table">
                  <tbody>
                    {state.data.results.map((r) => (
                      <tr key={r.id}>
                        <td dir="ltr" style={{ fontSize: 12 }}>{r.email ?? emailOf?.get(r.id) ?? r.id}</td>
                        <td>{r.ok ? <StatusBadge tone="success" label="تم" /> : <StatusBadge tone="danger" label="فشل" />}</td>
                        <td style={{ fontSize: 12 }}>{r.error ? t(r.error) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </form>
      </Modal>
  );
}
