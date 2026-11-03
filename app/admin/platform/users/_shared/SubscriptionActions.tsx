"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/bos/Form";
import { Modal } from "@/components/bos/Dialog";
import { useT } from "@/components/bos/I18n";
import { subscriptionAction } from "../subscription-actions";

// Subscription actions on the user page (owner, 2026-11-03, D-276): activate
// a plan without payment, renew, cancel at the end of the period or now, and
// add prospects. Each asks for a reason, kept in the admin log.
const KINDS = [
  { key: "activate", label: "تفعيل خطة بدون دفع" },
  { key: "renew", label: "تجديد الاشتراك" },
  { key: "prospects", label: "إضافة عملاء محتملين" },
  { key: "cancel_end", label: "إلغاء عند نهاية الفترة" },
  { key: "cancel_now", label: "إلغاء الآن" },
] as const;

export function SubscriptionActions({ workspaceId, plan, period }: { workspaceId: string; plan: string; period: string | null }) {
  const t = useT();
  const [kind, setKind] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const title = KINDS.find((k) => k.key === kind)?.label ?? "";
  return (
    <div className="yd-actions">
      <select className="yd-pick" aria-label={t("إجراء على الاشتراك…")} value={pick} onChange={(e) => setPick(e.target.value)}>
        <option value="">{t("إجراء على الاشتراك…")}</option>
        {KINDS.map((k) => <option key={k.key} value={k.key}>{t(k.label)}</option>)}
      </select>
      <button type="button" className="yd-btn" disabled={!pick} onClick={() => setKind(pick)}>{t("متابعة")}</button>
      <Modal open={kind !== null} onClose={() => setKind(null)} title={t(title)}>
        {kind && (
          <ActionForm action={subscriptionAction} onSuccess={() => setKind(null)} className="yd-form one">
            <input type="hidden" name="workspace_id" value={workspaceId} />
            <input type="hidden" name="kind" value={kind} />
            {kind === "activate" && (
              <>
                <label className="yd-field"><span>{t("الخطة")}</span><select name="plan" defaultValue={["growth", "scale"].includes(plan) ? plan : "growth"}><option value="growth">{t("النمو")}</option><option value="scale">{t("التوسع")}</option><option value="pro">{t("برو")}</option></select></label>
                <label className="yd-field"><span>{t("الفوترة")}</span><select name="period" defaultValue={period === "annual" ? "annual" : "monthly"}><option value="monthly">{t("شهري")}</option><option value="annual">{t("سنوي")}</option></select></label>
                <label className="yd-field"><span>{t("المدة بالشهور")}</span><input type="number" name="months" min={1} max={24} defaultValue={1} required dir="ltr" /></label>
              </>
            )}
            {kind === "renew" && <label className="yd-field"><span>{t("المدة بالشهور")}</span><input type="number" name="months" min={1} max={24} defaultValue={period === "annual" ? 12 : 1} required dir="ltr" /></label>}
            {kind === "prospects" && <label className="yd-field"><span>{t("عدد العملاء المحتملين")}</span><input type="number" name="prospects" min={1} max={1000000} required dir="ltr" /></label>}
            <label className="yd-field"><span>{t("السبب")}</span><input type="text" name="reason" minLength={3} maxLength={300} required /></label>
            <SubmitButton label={kind.startsWith("cancel") ? "تأكيد الإلغاء" : "تأكيد"} className={`yd-btn ${kind.startsWith("cancel") ? "danger-solid" : "primary"}`} />
          </ActionForm>
        )}
      </Modal>
    </div>
  );
}
