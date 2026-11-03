"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";
import { type ActionResult } from "@/app/(app)/settings/actions";
import { callAction, isNetworkFailure } from "@/lib/action-client";

export function useSave() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      setError(null);
      const r = await callAction(fn);
      if (isNetworkFailure(r)) setError(t.feedback.errors.network);
      else if (!r.ok) setError(r.error);
    });
  return { pending, error, run };
}
export function applyAppearance(theme?: string, size?: string) {
  const d = document.documentElement;
  if (theme) d.setAttribute("data-theme", theme === "light" ? "light" : "dark");
  if (size) d.setAttribute("data-text-size", size);
}

/* ─────────────── General ─────────────── */
export function SettingRow({ id, label, desc, children }: { id?: string; label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="setting-row" data-setting={id}>
      <div className="setting-label-wrap">
        <div className="setting-label">{label}</div>
        <div className="setting-desc">{desc}</div>
      </div>
      {children}
    </div>
  );
}
export function YoliasMarkStatic() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/logo-mark.png" alt="" width={20} height={21} />;
}

/* ─────────────── Team ─────────────── */

/** "Add people", like an ad account's: the email, then the role (D-275). */
