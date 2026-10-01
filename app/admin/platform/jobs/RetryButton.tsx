"use client";

import { ActionForm, SubmitButton } from "@/components/bos/Form";
import { retryJobAction } from "./actions";

export function RetryButton({ id }: { id: number }) {
  return (
    <ActionForm action={retryJobAction} successMessage="أُعيدت إلى الطابور" guardUnsaved={false} className="">
      <input type="hidden" name="id" value={id} />
      <SubmitButton label="إعادة المحاولة" pendingLabel="..." className="admin-btn small secondary" />
    </ActionForm>
  );
}
