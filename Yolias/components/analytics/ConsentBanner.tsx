"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";
import { writeConsent } from "@/lib/analytics/consent";

// First visit: essential cookies only until the visitor chooses (Cookie Policy).
export function ConsentBanner() {
  const { t } = useI18n();
  const c = t.consent;
  return (
    <div className="consent-banner" role="dialog" aria-live="polite" aria-label={c.policy}>
      <p>
        {c.text} <Link href="/legal/cookies">{c.policy}</Link>
      </p>
      <div className="consent-actions">
        <button type="button" className="btn-secondary" onClick={() => writeConsent("essential")}>{c.essential}</button>
        <button type="button" className="btn-primary" onClick={() => writeConsent("all")}>{c.accept}</button>
      </div>
    </div>
  );
}
