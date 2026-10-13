"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatCents, type PayoutMethod } from "@/lib/affiliates/program";
import { joinAction, requestPayoutAction, savePayoutAction } from "./actions";

/** Start as a partner: accept the terms — approved at once, no questions (D-206). */
export function PartnerStart({ termsVersion, terms, earn }: { termsVersion: string; terms: string; earn: string }) {
  const { t } = useI18n();
  const a = t.affiliate;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const submit = () => {
    if (pending) return;
    if (!accepted) return setError(a.errors.terms);
    setError(null);
    start(async () => {
      const r = await callAction(() => joinAction(termsVersion));
      if (isNetworkFailure(r)) return setError(a.errors.network);
      if (!r.ok) return setError(a.errors[r.error as keyof typeof a.errors] ?? a.errors.failed);
      router.refresh();
    });
  };

  return (
    <section className="panel-card affiliate-apply">
      <h4 className="panel-title">{a.apply.title}</h4>
      <p>{a.apply.lead}</p>
      <p className="affiliate-earn">{earn}</p>
      <details className="affiliate-terms">
        <summary>{fmt(a.apply.terms, { version: termsVersion })}</summary>
        <div className="affiliate-terms-body">{terms}</div>
      </details>
      <label className="affiliate-accept">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span>{a.apply.accept}</span>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div><button className="btn-primary" type="button" onClick={submit} disabled={pending} aria-busy={pending}><span>{pending ? a.apply.sending : a.apply.submit}</span></button></div>
    </section>
  );
}

export function ReferralLink({ link, howItWorks }: { link: string; howItWorks: string }) {
  const { t } = useI18n();
  const a = t.affiliate;
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState(false);
  const clean = campaign.trim().replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 60);
  const full = clean ? `${link}?c=${clean}` : link;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <section className="panel-card affiliate-link">
      <h4 className="panel-title">{a.link.title}</h4>
      <div className="affiliate-link-row">
        <input className="form-input" dir="ltr" readOnly value={full} aria-label={a.link.title} onFocus={(e) => e.currentTarget.select()} />
        <button className="btn-secondary" type="button" onClick={copy} aria-live="polite">
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}<span>{copied ? a.link.copied : a.link.copy}</span>
        </button>
      </div>
      <div className="field">
        <label htmlFor="aff-campaign">{a.link.campaign}</label>
        <input id="aff-campaign" className="form-input" dir="ltr" value={campaign} maxLength={60} onChange={(e) => setCampaign(e.target.value)} placeholder="newsletter-oct" />
        <p className="field-note">{a.link.campaignHint}</p>
      </div>
      <p className="cell-sub">{howItWorks}</p>
    </section>
  );
}

export function PayoutPanel({ methods, method, details, availableCents, minCents, open }: {
  methods: PayoutMethod[]; method: string | null; details: string | null; availableCents: number; minCents: number; open: boolean;
}) {
  const { t } = useI18n();
  const p = t.affiliate.payout;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [m, setM] = useState(method && methods.some((x) => x.id === method) ? method : methods[0]?.id ?? "");
  const [det, setDet] = useState(details ?? "");
  const saved = method === m && (details ?? "") === det.trim();
  const canRequest = !open && availableCents >= minCents && saved && !!det.trim();
  const err = (code: string) => p.errors[code as keyof typeof p.errors] ?? p.errors.failed;

  const save = () => start(async () => {
    setMsg(null);
    const r = await callAction(() => savePayoutAction({ method: m, details: det }));
    if (isNetworkFailure(r)) return setMsg({ ok: false, text: t.affiliate.errors.network });
    if (!r.ok) return setMsg({ ok: false, text: err(r.error) });
    setMsg({ ok: true, text: p.saved });
    router.refresh();
  });
  const request = () => start(async () => {
    if (!canRequest) return;
    setMsg(null);
    const r = await callAction(() => requestPayoutAction({ method: m }));
    if (isNetworkFailure(r)) return setMsg({ ok: false, text: t.affiliate.errors.network });
    if (!r.ok) return setMsg({ ok: false, text: err(r.error) });
    setMsg({ ok: true, text: p.requested });
    router.refresh();
  });

  return (
    <section className="panel-card affiliate-payout">
      <h4 className="panel-title">{p.title}</h4>
      {methods.length === 0 ? <p className="panel-empty">{p.noMethods}</p> : (
        <>
          <div className="affiliate-payout-grid">
            <div className="field">
              <label htmlFor="aff-method">{p.method}</label>
              <select id="aff-method" className="form-input" value={m} onChange={(e) => setM(e.target.value)} disabled={pending}>
                {methods.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="aff-details">{p.details}</label>
              <textarea id="aff-details" className="form-input" rows={2} maxLength={1000} value={det} onChange={(e) => setDet(e.target.value)} disabled={pending} />
              <p className="field-note">{p.detailsHint}</p>
            </div>
          </div>
          <div className="affiliate-payout-actions">
            <button className="btn-secondary" type="button" onClick={save} disabled={pending || saved}><span>{p.save}</span></button>
            <button className="btn-primary" type="button" onClick={request} disabled={pending || !canRequest} aria-busy={pending}>
              <span>{pending ? p.requesting : fmt(p.request, { amount: formatCents(Math.max(0, availableCents)) })}</span>
            </button>
          </div>
          {open ? <p className="field-note">{p.open}</p> : availableCents < minCents ? <p className="field-note">{fmt(p.belowMin, { min: formatCents(minCents) })}</p> : null}
        </>
      )}
      {msg && <p className={msg.ok ? "form-success" : "form-error"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
      <p className="cell-sub affiliate-note">{p.manual}</p>
    </section>
  );
}
