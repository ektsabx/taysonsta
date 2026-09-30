"use client";

import { Tx } from "@/components/bos/I18n";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeActivityAction, setActivityStatusAction } from "@/app/admin/sales/activities/actions";

export function ActivityRowActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "تعذر التنفيذ");
      else router.refresh();
    });
  }

  return (
    <span className="bos-row" style={{ gap: 4, justifyContent: "flex-end" }}>
      <button
        type="button"
        className="admin-btn small success"
        disabled={pending}
        onClick={() => {
          const outcome = window.prompt("النتيجة (اختياري)") ?? undefined;
          run(() => completeActivityAction(id, outcome));
        }}
      >
        <Tx>إكمال</Tx>
      </button>
      <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => run(() => setActivityStatusAction(id, "cancelled"))}>
        <Tx>إلغاء</Tx>
      </button>
      {error ? <span className="bos-field-error"><Tx>{error}</Tx></span> : null}
    </span>
  );
}
