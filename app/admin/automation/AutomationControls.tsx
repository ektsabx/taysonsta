"use client";

import { useT, Tx } from "@/components/bos/I18n";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionButton, ConfirmButton } from "@/components/bos/Dialog";
import { deleteRuleAction, retryRunAction, runSweepAction, toggleRuleAction } from "./actions";

export function RuleToggle({ id, active }: { id: string; active: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return <input type="checkbox" checked={active} disabled={pending} aria-label={t("نشط")} onChange={(e) => start(async () => { await toggleRuleAction(id, e.target.checked); router.refresh(); })} />;
}

export function DeleteRuleButton({ id }: { id: string }) {
  return <ConfirmButton label="حذف" className="admin-btn small danger" message="حذف مسار العمل نهائياً؟ سجل التشغيلات السابقة سيُحذف معه." action={() => deleteRuleAction(id)} />;
}

export function RetryButton({ id }: { id: string }) {
  return <ActionButton label="إعادة التشغيل" className="admin-btn small ghost" action={() => retryRunAction(id)} />;
}

export function RunSweepButton() {
  const [pending, start] = useTransition();
  const [out, setOut] = useState<string | null>(null);
  const router = useRouter();
  return (
    <span className="bos-row" style={{ gap: 6 }}>
      <button type="button" className="admin-btn small" disabled={pending} onClick={() => start(async () => {
        const r = await runSweepAction();
        setOut(r.ok ? `${r.message} — ${(r.data ?? []).map((s) => `${s.step}: ${s.count ?? "✓"}`).join(" · ")}` : r.error);
        router.refresh();
      })}><Tx>{pending ? "جارٍ التنفيذ..." : "تشغيل الفحوصات المجدولة الآن"}</Tx></button>
      {out ? <span className="bos-faint" style={{ fontSize: 12 }}><Tx>{out}</Tx></span> : null}
    </span>
  );
}
