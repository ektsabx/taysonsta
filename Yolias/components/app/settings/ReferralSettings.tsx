"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { referralState, type ReferralState } from "@/app/(app)/settings/referral-actions";

// Settings → Referral (owner, 2026-10-28): the invite link, what it brought, the latest sign-ups.
export function ReferralSettings() {
  const { t, locale } = useI18n();
  const r = t.settings.referral;
  const [s, setS] = useState<ReferralState | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { referralState().then(setS).catch(() => setS(null)); }, []);
  const n = (v: number) => formatNumber(v, locale);
  if (!s) return <div className="setting-group"><p className="setting-desc">…</p></div>;
  return (
    <div className="setting-group">
      <div className="setting-row" data-setting="referral-link">
        <div className="setting-info">
          <div className="setting-label">{r.title}</div>
          <div className="setting-desc">{s.enabled ? fmt(r.desc, { n: n(s.reward) }) : r.off}</div>
        </div>
      </div>
      {s.enabled && (
        <div className="referral-link">
          <input className="form-input" dir="ltr" readOnly value={s.link} onFocus={(e) => e.target.select()} aria-label={r.title} />
          <button type="button" className="btn-secondary" onClick={() => { void navigator.clipboard.writeText(s.link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }}>
            {copied ? <Check /> : <Copy />} {copied ? r.copied : r.copy}
          </button>
        </div>
      )}
      <div className="referral-stats">
        <div><span>{r.joined}</span><strong>{n(s.joined)}</strong></div>
        <div><span>{r.earned}</span><strong>{n(s.earned)}</strong></div>
        <div><span>{r.month}</span><strong>{n(s.thisMonth)}</strong><em>{fmt(r.monthNote, { cap: n(s.monthlyCap) })}</em></div>
      </div>
      <div className="setting-label" style={{ marginTop: 18 }}>{r.recent}</div>
      {!s.recent.length ? <p className="setting-desc">{r.none}</p> : (
        <ul className="referral-list">
          {s.recent.map((x, i) => (
            <li key={i}>
              <span dir="auto">{x.name || "-"}</span>
              <span className="setting-desc">{new Date(x.at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", { day: "numeric", month: "short" })}</span>
              <span className={`referral-status ${x.status}`}>{fmt(r.status[x.status], { n: n(x.prospects) })}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="setting-desc" style={{ marginTop: 14 }}>{r.rules}</p>
    </div>
  );
}
