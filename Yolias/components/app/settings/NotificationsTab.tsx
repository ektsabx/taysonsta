"use client";

import { useState } from "react";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { updatePreferences } from "@/app/(app)/settings/actions";
import type { ShellData } from "../types";
import { useSave, SettingRow } from "./shared";

export function NotificationsTab({ data }: { data: ShellData }) {
  const { t } = useI18n();
  const nt = t.settings.notifications;
  const [prefs, setPrefs] = useState(data.preferences);
  const { error, run } = useSave();
  const items = [
    // The five the owner asked for (D-273), on by default, then replies, usage and billing.
    { key: "notify_review", id: "notify-review", label: nt.review, desc: nt.reviewDesc },
    { key: "notify_daily_changes", id: "notify-changes", label: nt.changes, desc: nt.changesDesc },
    { key: "notify_daily_summary", id: "notify-summary", label: nt.summary, desc: nt.summaryDesc },
    { key: "notify_product", id: "notify-product", label: nt.product, desc: nt.productDesc },
    { key: "notify_founder", id: "notify-founder", label: nt.founder, desc: nt.founderDesc },
    { key: "notify_sales", id: "notify-sales", label: nt.sales, desc: nt.salesDesc },
    { key: "notify_usage", id: "notify-usage", label: nt.usage, desc: nt.usageDesc },
    { key: "notify_billing", id: "notify-billing", label: nt.billing, desc: nt.billingDesc },
  ] as const;

  const toggle = (key: (typeof items)[number]["key"], value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    run(() => updatePreferences({ [key]: value }));
  };

  return (
    <div className="setting-group">
      <p className="setting-intro">{fmt(nt.intro, { email: data.user.email })}</p>
      {items.map((it) => (
        <SettingRow key={it.key} id={it.id} label={it.label} desc={it.desc}>
          <label className="switch">
            <input type="checkbox" checked={prefs[it.key]} onChange={(e) => toggle(it.key, e.target.checked)} aria-label={it.label} />
            <span className="slider" />
          </label>
        </SettingRow>
      ))}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

/* ─────────────── Usage ─────────────── */
