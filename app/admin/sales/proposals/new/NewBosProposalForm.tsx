"use client";

import { Tx, useT } from "@/components/bos/I18n";

import { useActionState, useState } from "react";
import { EntitySelector, type EntityOption } from "@/components/bos/EntitySelector";
import { searchEntitiesAction } from "@/app/admin/_actions/common";
import { createProposalAction, type FormState } from "@/app/admin/proposals/actions";

const initialState: FormState = { error: null };

export function NewBosProposalForm({ initialDeal, initialClient }: { initialDeal: EntityOption | null; initialClient: EntityOption | null }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(createProposalAction, initialState);
  const [deal, setDeal] = useState<EntityOption | null>(initialDeal);

  return (
    <form action={formAction} className="bos-form">
      <section className="bos-form-section">
        <h2><Tx>المقترح</Tx></h2>
        <p className="bos-muted" style={{ fontSize: 13, marginBottom: 12 }}>
          <Tx>الأفضل إنشاء المقترح من الصفقة: سيُملأ العميل والبنود والإجمالي وجدول الدفعات والنطاق تلقائياً.</Tx>
        </p>
        <div className="bos-form-grid">
          <div className="bos-field span-2">
            <label><Tx>الصفقة</Tx></label>
            <EntitySelector name="dealId" search={(q) => searchEntitiesAction("deal", q)} initial={initialDeal} onChange={setDeal} placeholder="ابحث عن الصفقة..." />
          </div>
          {!deal ? (
            <div className="bos-field span-2">
              <label><Tx>أو الحساب مباشرة (بدون صفقة)</Tx></label>
              <EntitySelector name="clientId" search={(q) => searchEntitiesAction("client", q)} initial={initialClient} placeholder="ابحث عن حساب..." />
            </div>
          ) : null}
          <div className="bos-field span-2">
            <label htmlFor="title">عنوان المقترح {deal ? <span className="bos-faint"><Tx>(اختياري — افتراضياً اسم الصفقة)</Tx></span> : <span className="req">*</span>}</label>
            <input id="title" name="title" placeholder="AI Customer Service & Business Automation" required={!deal} />
          </div>
          <div className="bos-field span-2">
            <label htmlFor="subtitle"><Tx>عنوان فرعي</Tx></label>
            <input id="subtitle" name="subtitle" placeholder={t("مقترح تطوير وتشغيل منصة")} />
          </div>
        </div>
      </section>
      {state.error ? <div className="bos-form-error"><Tx>{state.error}</Tx></div> : null}
      <div className="bos-form-actions">
        <button type="submit" className="admin-btn" disabled={pending} aria-busy={pending}>
          <Tx>{pending ? "جارِ الإنشاء..." : "إنشاء ومتابعة إلى المحتوى"}</Tx>
        </button>
      </div>
    </form>
  );
}
