"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { planName, priceFor } from "@/lib/plans";
import { useToast } from "@/components/Toast";
import { setPlanCanceled } from "@/app/(app)/settings/actions";
import type { ShellData } from "../types";
import type { Currency } from "@/types/database";
import { useSave, YoliasMarkStatic } from "./shared";

export function BillingTab({ data }: { data: ShellData }) {
  const { t, locale } = useI18n();
  const b = t.settings.billing;
  const toast = useToast();
  const router = useRouter();
  const { workspace } = data;
  const canManage = data.role === "owner" || data.role === "admin";
  const paid = workspace.plan !== "free";
  const [confirming, setConfirming] = useState(false);
  const { pending, error, run } = useSave();
  const money = (v: number, currency: Currency = "USD") => formatMoney(v, currency, true);
  const price = priceFor(workspace.price, workspace.billingPeriod);

  const setCanceled = (cancel: boolean) =>
    run(async () => {
      const r = await setPlanCanceled(cancel);
      if (r.ok) {
        setConfirming(false);
        toast(cancel ? b.canceledToast : b.resumedToast);
        router.refresh();
      }
      return r;
    });

  const trialing = workspace.subscriptionStatus === "trialing";
  const renewLine = !paid
    ? fmt(b.freeLine, { count: formatNumber(workspace.prospects, locale) })
    : trialing && data.usage.trialEndsAt
      ? fmt(t.plans.trialEnds, { date: formatDate(data.usage.trialEndsAt, locale, data.preferences.timezone) })
    : workspace.periodEnd
      ? fmt(workspace.cancelAtPeriodEnd ? b.endsOn : b.renewsOn, { date: formatDate(workspace.periodEnd, locale, data.preferences.timezone) })
      : "";

  return (
    <div className="billing">
      <section className="billing-plan" data-setting="plan">
        <div className="billing-plan-icon"><YoliasMarkStatic /></div>
        <div className="billing-plan-main">
          <div className="billing-plan-name">
            {planName(workspace.plan, t)}
            {workspace.subscriptionStatus === "test" && <span className="coming-soon">{b.testMode}</span>}
            {trialing && <span className="coming-soon">{t.plans.trialing}</span>}
          </div>
          <div className="billing-plan-sub">
            {paid && <>{workspace.billingPeriod === "annual" ? t.plans.annual : t.plans.monthly} · <span dir="ltr">{money(price, workspace.currency)}</span>{workspace.billingPeriod === "annual" ? b.perYear : t.common.perMonth}<br /></>}
            {renewLine}
          </div>
        </div>
        {/* Polar subscriptions are managed in Polar's hosted customer portal (plan, card, invoices, cancel). */}
        {canManage && (data.billing.portalUrl
          ? <a className="btn-secondary" href={data.billing.portalUrl} target="_blank" rel="noopener noreferrer">{b.manageBilling}</a>
          : <a className="btn-secondary" href="/checkout">{paid ? b.adjustPlan : b.upgrade}</a>)}
      </section>

      {canManage && (
        <>
          <section className="billing-section" data-setting="payment">
            <h4>{b.payment}</h4>
            <div className="billing-row">
              <div className="billing-card">
                <CreditCard />
                <span>{data.billing.online ? t.checkout.paymentSecure : b.noCard}</span>
              </div>
            </div>
          </section>

          <section className="billing-section" data-setting="invoices">
            <h4>{b.invoices}</h4>
            {data.invoices.length === 0 ? (
              <p className="billing-empty">{b.noInvoices}</p>
            ) : (
              <table className="billing-table">
                <thead>
                  <tr><th>{b.colDate}</th><th>{b.colTotal}</th><th>{b.colStatus}</th><th><span className="sr-only">{b.colActions}</span></th></tr>
                </thead>
                <tbody>
                  {data.invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{formatDate(inv.date, locale, data.preferences.timezone)}</td>
                      <td dir="ltr" className="text-start">{money(inv.amount, inv.currency)}</td>
                      <td>
                        <span className={`status-pill ${inv.status}`}>{b.status[inv.status]}</span>
                        {inv.test && <span className="billing-test">{b.test}</span>}
                      </td>
                      <td className="billing-actions"><a href={`/invoices/${inv.id}`} target="_blank" rel="noopener">{b.view}</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {paid && (
            <section className="billing-section" data-setting="cancellation">
              <h4>{b.cancellation}</h4>
              {data.billing.portalUrl ? (
                // Polar subscriptions are canceled or resumed in Polar's portal; its webhook updates Yolias.
                <div className="billing-row">
                  <div className="billing-row-text">{workspace.cancelAtPeriodEnd ? fmt(b.canceledNote, { date: workspace.periodEnd ? formatDate(workspace.periodEnd, locale, data.preferences.timezone) : "" }) : b.cancelInPortal}</div>
                  <a className="btn-secondary" href={data.billing.portalUrl} target="_blank" rel="noopener noreferrer">{b.manageBilling}</a>
                </div>
              ) : workspace.cancelAtPeriodEnd ? (
                <div className="billing-row">
                  <div className="billing-row-text">{fmt(b.canceledNote, { date: workspace.periodEnd ? formatDate(workspace.periodEnd, locale, data.preferences.timezone) : "" })}</div>
                  <button className="btn-secondary" type="button" disabled={pending} onClick={() => setCanceled(false)}>{b.resume}</button>
                </div>
              ) : confirming ? (
                <div className="billing-confirm">
                  <p>{fmt(b.cancelConfirm, { date: workspace.periodEnd ? formatDate(workspace.periodEnd, locale, data.preferences.timezone) : "" })}</p>
                  <div>
                    <button className="btn-secondary" type="button" onClick={() => setConfirming(false)}>{b.keepPlan}</button>
                    <button className="btn-danger solid" type="button" disabled={pending} onClick={() => setCanceled(true)}>{b.cancelPlan}</button>
                  </div>
                </div>
              ) : (
                <div className="billing-row">
                  <div className="billing-row-text">{b.cancelPlan}</div>
                  <button className="btn-danger-ghost" type="button" onClick={() => setConfirming(true)}>{b.cancel}</button>
                </div>
              )}
            </section>
          )}
          {error && <p className="form-error">{error}</p>}
        </>
      )}
      {!canManage && <p className="billing-empty">{b.adminsOnly}</p>}
    </div>
  );
}
