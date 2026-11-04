"use client";

import { SpendingLimit } from "@/components/app/settings/SpendingLimit";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatMoney } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { topPlan } from "@/lib/plans";
import { useToast } from "@/components/Toast";
import { buyProspectPack } from "@/app/checkout/actions";
import { billingOverview } from "@/app/(app)/settings/actions";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { metaTrack, track } from "@/lib/analytics/client";
import type { ShellData } from "../types";

type Overview = Awaited<ReturnType<typeof billingOverview>>;
const usd = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Credit and billing (owner, 2026-11-05): the balance in dollars, top-ups, and
// what the balance went on. A line with nothing spent shows a dash.
export function UsageTab({ data }: { data: ShellData }) {
  const { t, locale } = useI18n();
  const c = t.settings.usage.wallet;
  const [o, setO] = useState<Overview | null>(null);
  const load = () => { void billingOverview().then(setO).catch(() => setO(null)); };
  useEffect(() => { load(); }, []);
  const lines = [["search", c.search], ["data", c.data], ["messages", c.messages], ["campaigns", c.campaigns]] as const;

  return (
    <div className="setting-group credit-page" data-setting="plan-usage">
      <header className="credit-head">
        <div><h3>{c.title}</h3><p>{c.lead}</p></div>
        {data.workspace.plan !== topPlan && (data.role === "owner" || data.role === "admin") && <a className="btn-secondary" href="/checkout">{t.settings.usage.upgrade}</a>}
      </header>

      <section className="credit-balance">
        <span>{c.balance}</span>
        <strong dir="ltr">{o ? usd(o.balanceUsd) : "–"}</strong>
        <em>{c.available}</em>
        <small>{o?.resetsAt ? fmt(c.renews, { date: formatDate(o.resetsAt, locale, data.preferences.timezone) }) : c.prepaid}</small>
      </section>

      <BuyMore data={data} onBought={load} />

      <section>
        <h4 className="credit-sub">{c.spent}</h4>
        <ul className="credit-lines">
          {lines.map(([k, label]) => <li key={k}><span>{label}</span><b dir="ltr">{o && o.spent[k] > 0 ? usd(o.spent[k]) : "–"}</b></li>)}
        </ul>
      </section>

      {/* D-274 (owner): the account spending limit lives with the usage. */}
      <SpendingLimit />
    </div>
  );
}

/* ─────────────── Top up ─────────────── */
function BuyMore({ data, onBought }: { data: ShellData; onBought: () => void }) {
  const { t } = useI18n();
  const bm = t.buyMore, c = t.settings.usage.wallet;
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
    toast(`${c.added} ${bm.testMode}`);
    onBought();
    router.refresh();
  };

  return (
    <section data-setting="buy-more">
      <h4 className="credit-sub">{c.topUp}</h4>
      <p className="credit-note">{c.packs}</p>
      {canManage ? (
        <ul className="credit-packs">
          {data.packs.map((p) => {
            const price = formatMoney(p.price, data.workspace.currency);
            return (
              <li key={p.id}>
                <strong dir="ltr">{price}</strong>
                <span>{fmt(c.packName, { amount: `\u2066${price}\u2069` })}</span>
                <button className="btn-secondary" type="button" disabled={busy !== null} onClick={() => buy(p.id)}>{busy === p.id ? bm.buying : c.buy}</button>
              </li>
            );
          })}
        </ul>
      ) : <p className="billing-empty">{bm.onlyAdmins}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}

/* ─────────────── Billing ─────────────── */
