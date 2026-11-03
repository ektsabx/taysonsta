"use client";

import { SpendingLimit } from "@/components/app/settings/SpendingLimit";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { planName, topPlan } from "@/lib/plans";
import { useToast } from "@/components/Toast";
import { buyProspectPack } from "@/app/checkout/actions";
import { refreshUsage } from "@/app/(app)/settings/actions";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { metaTrack, track } from "@/lib/analytics/client";
import type { ShellData } from "../types";

export function UsageTab({ data }: { data: ShellData }) {
  const { t, locale } = useI18n();
  const u = t.settings.usage;
  const { workspace } = data;
  const [usage, setUsage] = useState(() => ({ ...data.usage, allowance: workspace.prospects, checkedAt: Date.now() }));
  const [refreshing, startRefresh] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const n = (v: number) => formatNumber(v, locale);
  const pct = Math.min(100, usage.allowance ? (usage.prospects / usage.allowance) * 100 : 0);

  const refresh = () =>
    startRefresh(async () => {
      const r = await refreshUsage();
      setUsage({ prospects: r.prospects, allowance: r.allowance, extra: r.extra, resetsAt: r.resetsAt, emails: r.emails, contacts: r.contacts, trialEndsAt: r.trialEndsAt, checkedAt: Date.parse(r.checkedAt) });
      setNow(Date.parse(r.checkedAt));
    });

  // Fresh numbers whenever the tab opens, and "Last updated" keeps ticking.
  useEffect(() => {
    refresh();
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="setting-group">
      {/* D-274 (owner): the account spending limit lives with the usage. */}
      <SpendingLimit />
      <div className="usage-head" data-setting="plan-usage">
        <div>
          <div className="setting-label">{u.title}</div>
          <div className="setting-desc">{usage.trialEndsAt
            ? fmt(u.trialLine, { plan: planName(workspace.plan, t), date: formatDate(usage.trialEndsAt, locale, data.preferences.timezone) })
            : fmt(workspace.plan === "free" ? u.planLineFree : u.planLine, { plan: planName(workspace.plan, t) })}</div>
        </div>
        {workspace.plan !== topPlan && (data.role === "owner" || data.role === "admin") && (
          <a className="btn-secondary" href="/checkout">{u.upgrade}</a>
        )}
      </div>

      <div className="usage-meter">
        <div className="usage-meter-row">
          <span className="usage-meter-label">{u.prospects}</span>
          <span className="usage-meter-value">{fmt(u.value, { used: n(usage.prospects), total: n(usage.allowance) })}</span>
        </div>
        <div className="progress-track"><div className={`progress-fill${pct >= 100 ? " red" : pct >= 80 ? " near" : ""}`} style={{ width: `${pct.toFixed(1)}%` }} /></div>
        <div className="usage-meter-foot">
          <span />
          <span>{usage.resetsAt ? fmt(u.resets, { date: formatDate(usage.resetsAt, locale, data.preferences.timezone) }) : usage.trialEndsAt ? u.trialOnly : u.oneTime}</span>
        </div>
        {usage.extra > 0 && <div className="usage-extra">{fmt(t.buyMore.extraBalance, { count: n(usage.extra) })}</div>}
      </div>

      <BuyMore data={data} pct={pct} onBought={refresh} />

      <div className="usage-updated">
        <span>{fmt(u.lastUpdated, { when: relativeTime(usage.checkedAt, now, locale, u.justNow) })}</span>
        <button type="button" className={`usage-refresh${refreshing ? " spinning" : ""}`} onClick={refresh} disabled={refreshing} aria-label={u.refresh} title={u.refresh}>
          <RotateCw />
        </button>
      </div>
    </div>
  );
}

// "less than a minute ago" / "5 minutes ago" in the interface language.
function relativeTime(ms: number, now: number, locale: string, justNow: string): string {
  const mins = Math.floor((now - ms) / 60_000);
  if (mins < 1) return justNow;
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en", { numeric: "auto" });
  return mins < 60 ? rtf.format(-mins, "minute") : rtf.format(-Math.floor(mins / 60), "hour");
}

/* ─────────────── Buy More Prospects ─────────────── */
function BuyMore({ data, pct, onBought }: { data: ShellData; pct: number; onBought: () => void }) {
  const { t, locale } = useI18n();
  const bm = t.buyMore;
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = data.role === "owner" || data.role === "admin";
  const available = data.billing.online || data.billing.testMode;
  if (!available || data.packs.length === 0) return null;

  const buy = async (id: string) => {
    setBusy(id);
    setError(null);
    const pack = data.packs.find((p) => p.id === id);
    if (pack) {
      track("buy_more_opened", { prospects: pack.prospects, value: pack.price, currency: data.workspace.currency });
      metaTrack("InitiateCheckout", { value: pack.price, currency: data.workspace.currency, content_type: "product", content_ids: [`prospects_${pack.prospects}`], num_items: 1 });
    }
    const r = await callAction(() => buyProspectPack(id)).finally(() => setBusy(null));
    if (!r) return; // redirected to the payment page
    if (isNetworkFailure(r)) return setError(t.checkout.errors.network);
    if (!r.ok) return setError(r.error);
    toast(`${fmt(bm.added, { count: formatNumber(r.added, locale) })} ${bm.testMode}`);
    onBought();
    router.refresh();
  };

  // Like a usage limit: a callout when it's close or reached, packs right under it.
  const state = pct >= 100 ? "out" : pct >= 80 ? "near" : null;
  return (
    <section className="buy-more" data-setting="buy-more">
      {state && (
        <div className={`buy-more-callout ${state}`} role="status">
          <strong>{state === "out" ? bm.outTitle : fmt(bm.nearTitle, { pct: Math.floor(pct) })}</strong>
          <span>{state === "out" ? bm.outBody : bm.nearBody}</span>
        </div>
      )}
      <div className="setting-label">{bm.title}</div>
      <div className="setting-desc">{bm.lead}</div>
      {canManage ? (
        <ul className="buy-more-packs">
          {data.packs.map((p) => (
            <li key={p.id}>
              <span className="buy-more-name">
                {fmt(bm.packName, { count: formatNumber(p.prospects, locale) })}
              </span>
              <span dir="ltr" className="buy-more-price">{formatMoney(p.price, data.workspace.currency)}</span>
              <button className={state ? "btn-primary" : "btn-secondary"} type="button" disabled={busy !== null} onClick={() => buy(p.id)}>{busy === p.id ? bm.buying : bm.buy}</button>
            </li>
          ))}
        </ul>
      ) : <p className="billing-empty">{bm.onlyAdmins}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}

/* ─────────────── Billing ─────────────── */
