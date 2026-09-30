"use client";

import { Tx } from "@/components/bos/I18n";

import { useActionState } from "react";
import { createAccessAction, resetAccessPasswordAction, type AccessFormState } from "../../actions";

const initialState: AccessFormState = { error: null };

export function AccessPanel({ proposalId, existingEmail }: { proposalId: string; existingEmail: string | null }) {
  const boundCreate = createAccessAction.bind(null, proposalId);
  const boundReset = resetAccessPasswordAction.bind(null, proposalId);
  const [createState, createFormAction, createPending] = useActionState(boundCreate, initialState);
  const [resetState, resetFormAction, resetPending] = useActionState(boundReset, initialState);

  return (
    <div className="admin-card">
      <h2>Step 4 — Client Access</h2>
      {existingEmail ? (
        <>
          <p style={{ fontSize: 13, marginBottom: 12 }}>
            <Tx>بيانات الدخول مُنشأة بالفعل للبريد:</Tx> <strong><Tx>{existingEmail}</Tx></strong>
          </p>
          <form action={resetFormAction}>
            <div className="admin-field">
              <label htmlFor="resetPassword"><Tx>كلمة مرور جديدة</Tx></label>
              <input id="resetPassword" name="password" type="password" minLength={8} required />
            </div>
            {resetState.error ? <p className="admin-error"><Tx>{resetState.error}</Tx></p> : null}
            <button type="submit" className="admin-btn secondary" disabled={resetPending}>
              <Tx>{resetPending ? "جارِ التحديث..." : "إعادة تعيين كلمة المرور"}</Tx>
            </button>
          </form>
        </>
      ) : (
        <form action={createFormAction}>
          <p style={{ fontSize: 13, marginBottom: 12, color: "rgba(var(--bos-fg-rgb), 0.6)" }}>
            <Tx>أنشئ بيانات دخول خاصة بالعميل ليتمكن من رؤية مقترحه فقط. مطلوب قبل النشر.</Tx>
          </p>
          <div className="admin-field">
            <label htmlFor="accessEmail"><Tx>البريد الإلكتروني</Tx></label>
            <input id="accessEmail" name="email" type="email" required />
          </div>
          <div className="admin-field">
            <label htmlFor="accessPassword"><Tx>كلمة المرور</Tx></label>
            <input id="accessPassword" name="password" type="password" minLength={8} required />
          </div>
          {createState.error ? <p className="admin-error"><Tx>{createState.error}</Tx></p> : null}
          <button type="submit" className="admin-btn" disabled={createPending}>
            <Tx>{createPending ? "جارِ الإنشاء..." : "Create Proposal Access"}</Tx>
          </button>
        </form>
      )}
    </div>
  );
}
