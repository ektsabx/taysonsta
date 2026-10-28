"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { referralState, type ReferralState } from "@/app/(app)/settings/referral-actions";
import { ShareButtons } from "@/components/ShareButtons";

// Settings → Referral (owner, 2026-10-28): the invite link, what it brought, the latest sign-ups.
export function ReferralSettings({ link }: { link: string }) {
  const { t, locale } = useI18n();
  const r = t.settings.referral;
  const [s, setS] = useState<ReferralState | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { referralState().then(setS).catch(() => setS(null)); }, []);
  const n = (v: number) => formatNumber(v, locale);
  // The link shows at once (from the app shell); the numbers fill in when they arrive.
  const state: ReferralState = s ?? { enabled: true, link, reward: 50, monthlyCap: 20, joined: 0, earned: 0, thisMonth: 0, recent: [] };
  const loading = !s;
  return (
    <div className="setting-group">
      <div className="setting-row" data-setting="referral-link">
        <div className="setting-info">
          <div className="setting-label">{r.title}</div>
          <div className="setting-desc">{state.enabled ? fmt(r.desc, { n: n(state.reward) }) : r.off}</div>
        </div>
      </div>
      {state.enabled && (
        <div className="referral-link">
          <input className="form-input" dir="ltr" readOnly value={state.link} onFocus={(e) => e.target.select()} aria-label={r.title} />
          <button type="button" className="btn-secondary" onClick={() => { void navigator.clipboard.writeText(state.link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }}>
            {copied ? <Check /> : <Copy />} {copied ? r.copied : r.copy}
          </button>
        </div>
      )}
      {state.enabled && <ShareButtons link={state.link} />}
      {state.enabled && (
        <ol className="partners-steps" style={{ margin: "14px 0" }}>
          <li><strong>{r.step1}</strong><span>{r.step1Body}</span></li>
          <li><strong>{r.step2}</strong><span>{r.step2Body}</span></li>
          <li><strong>{r.step3}</strong><span>{fmt(r.step3Body, { n: n(state.reward) })}</span></li>
        </ol>
      )}
      <div className="referral-stats">
        <div><span>{r.joined}</span><strong>{n(state.joined)}</strong></div>
        <div><span>{r.earned}</span><strong>{n(state.earned)}</strong></div>
        <div><span>{r.month}</span><strong>{n(state.thisMonth)}</strong><em>{fmt(r.monthNote, { cap: n(state.monthlyCap) })}</em></div>
      </div>
      <div className="setting-label" style={{ marginTop: 18 }}>{r.recent}</div>
      {loading ? <p className="setting-desc">…</p> : !state.recent.length ? <p className="setting-desc">{r.none}</p> : (
        <ul className="referral-list">
          {state.recent.map((x, i) => (
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
