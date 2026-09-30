"use client";

import { Tx, useT } from "@/components/bos/I18n";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/bos/Form";
import { addCommentAction, deleteCommentAction } from "@/app/admin/_actions/common";

export function CommentComposer({ entityType, entityId, allowClientVisible }: { entityType: string; entityId: string; allowClientVisible?: boolean }) {
  const t = useT();
  return (
    <ActionForm action={addCommentAction} resetOnSuccess guardUnsaved={false} className="bos-stack">
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="entityId" value={entityId} />
      <div className="bos-field" style={{ marginTop: 10 }}>
        <textarea name="body" placeholder={t("اكتب ملاحظة... استخدم @الاسم للإشارة إلى زميل")} required maxLength={20000} />
      </div>
      <div className="bos-row" style={{ justifyContent: "space-between" }}>
        {allowClientVisible ? (
          <label className="bos-check">
            <input type="hidden" name="isInternal" value="true" />
            <input
              type="checkbox"
              onChange={(e) => {
                const hidden = e.currentTarget.previousElementSibling as HTMLInputElement;
                hidden.value = e.currentTarget.checked ? "false" : "true";
              }}
            />
            <Tx>مرئي للعميل</Tx>
          </label>
        ) : (
          <input type="hidden" name="isInternal" value="true" />
        )}
        <SubmitButton label="إضافة" pendingLabel="جارٍ الإضافة..." className="admin-btn small" />
      </div>
    </ActionForm>
  );
}

export function DeleteCommentButton({ commentId }: { commentId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      className="bos-link-muted"
      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11.5, marginInlineStart: "auto" }}
      disabled={pending}
      onClick={() => {
        if (!window.confirm("حذف هذه الملاحظة؟")) return;
        startTransition(async () => {
          await deleteCommentAction(commentId);
          router.refresh();
        });
      }}
    >
      <Tx>حذف</Tx>
    </button>
  );
}
