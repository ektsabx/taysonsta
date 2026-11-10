"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "@/components/LocaleLink";
import { Check, Plus, CircleAlert } from "lucide-react";
import { sendMagicLink } from "@/app/(auth)/actions";
import { ConsentText } from "@/app/(auth)/ConsentText";
import { formatMoney, formatNumber } from "@/lib/format";
import { fmt, type Dictionary } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { monthlyRate, planName, planPrice, priceFor, type PlanTerms } from "@/lib/plans";
import type { Currency, PaidPlan } from "@/types/database";
import { funnelEvent } from "@/lib/funnel-client";
import { pricingFaq } from "@/lib/pricing-copy";
import { planEstimates } from "@/lib/pricing-estimates";

type PricingCopy = Dictionary["pricing"];
type PlanId = PaidPlan;

// Pay As You Go, Growth and Scale (owner, 2026-11-02, D-275): prepaid credit
// or one of two plans, monthly or annual (20% off), no free trial. The
// prospect is the only unit. Every number comes from the configuration the
// limits are enforced with (plan_quotas, prospect_packs).
const tiers: PlanId[] = ["growth", "scale"];

// What every option includes, as an advertising platform (D-275).
const featureKeys = ["campaigns", "aiLeadGeneration", "messages", "aiSalesAgent", "crm", "pixel", "audiences", "optimization", "analytics", "integrations", "unlimitedUsers", "chatSupport"] as const;

interface Props {
  signedIn: boolean;
  /** Monthly prices and limits per plan (lib/plan-catalog.ts). */
  plans: Record<PlanId, PlanTerms>;
  currency: Currency;
  /** Free trial length in days when checkout offers one today, else null (lib/payments trialAvailable). */
  trialDays: number | null;
  /** The visitor is in Egypt: show the EGP prices (D-237). */
  egp: boolean;
  /** Pay As You Go top-up amounts and the prospects each gives (lib/credits). */
  topUps: { id: string; priceUsd: number; prospects: number }[];
}

export function PricingView({ signedIn, plans, currency, trialDays, egp, topUps }: Props) {
  const { t: dict, locale } = useI18n();
  const t = dict.pricing;
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  const n = (v: number) => formatNumber(v, locale);
  // Monthly prices only. Visitors from Egypt see the EGP prices they are charged (D-237).
  const list = (plan: PlanId) => planPrice(plans[plan], currency) ?? 0;
  // USD everywhere (owner, 2026-10-21); visitors from Egypt see the EGP charge in checkout.
  void egp;
  const price = (plan: PlanId) => formatMoney(monthlyRate(list(plan), period), currency);
  const usd = (v: number) => formatMoney(v, "USD");
  // Every card (owner, 2026-11-02, D-275): who it reaches and what that usually
  // brings (lib/pricing-estimates.ts, marked as estimates), then the platform.
  const C = t.card;
  // Every line has its explanation behind an info mark (owner, 2026-11-10).
  const H = t.cardHelp;
  const platform: Item[] = [{ text: C.campaigns, help: H.campaigns }, { text: C.messages, help: H.messages }, { text: C.agent, help: H.agent }, { text: C.pixel, help: H.pixel }, { text: C.users, help: H.users }];
  const outcome = (people: number, once = false) => {
    const e = planEstimates(people);
    return [
      { text: fmt(once ? C.reachOnce : C.reach, { count: n(people) }), help: H.reach },
      // One-time credit has no monthly estimate; a plan does.
      ...(!once && e.meetings.low > 0 ? [{ text: fmt(C.replies, { low: n(e.replies.low), high: n(e.replies.high) }), help: H.replies }, { text: fmt(C.meetings, { low: n(e.meetings.low), high: n(e.meetings.high) }), help: H.meetings }] : []),
    ] as Item[];
  };

  // Picking a plan → signup (new visitors) or checkout (signed in).
  const href = (plan: PlanId | "payg") => `${signedIn ? "/checkout" : "/signup"}?plan=${plan}${plan !== "payg" && period === "annual" ? "&period=annual" : ""}`;
  // Journey tracking (D-212): the plans were seen; a plan was picked.
  useEffect(() => { funnelEvent("plans_viewed"); }, []);
  const min = topUps[0];
  const paygCard = min ? (
    <PlanCard
      key="payg"
      onPick={() => funnelEvent("plan_selected", { plan: "payg" })}
      name={t.payg.name}
      price={t.payg.price}
      note={t.payg.note}
      items={[{ text: t.payg.onLaunch, help: H.onLaunch }, ...platform, { text: t.payg.noExpiry, help: H.noExpiry }]}
      href={signedIn ? "/dashboard?settings=usage" : "/signup?plan=payg"}
      cta={t.payg.cta}
      foot={t.payg.foot}
    />
  ) : null;
  const card = (plan: PlanId, recommended?: string) => (
    <PlanCard
      key={plan}
      onPick={() => funnelEvent("plan_selected", { plan, period })}
      name={planName(plan, dict)}
      price={price(plan)}
      note={t.perMonth}
      items={[...outcome(plans[plan].prospects), ...platform]}
      href={href(plan)}
      cta={t.getStarted}
      foot={period === "annual" ? fmt(dict.plans.billedYearlyAt, { amount: formatMoney(priceFor(list(plan), "annual"), currency) }) : t.paidFoot}
      recommended={recommended}
    />
  );

  return (
    <>
      <section id="pricing" className="hero">
        <div className="hero-fade">
          <div className="site-width text-center">
            <p className="eyebrow">{t.heroEyebrow}</p>
            <h1 className="display-font hero-title mt-5">{t.heroTitle}</h1>
            <p className="hero-copy">{t.heroSupport}</p>
            <div className="period-toggle pricing-period" role="tablist" aria-label={dict.plans.billedMonthly}>
              {(["monthly", "annual"] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={period === k} className={period === k ? "active" : ""} onClick={() => setPeriod(k)}>
                  {dict.plans[k]}{k === "annual" && <span className="plan-badge">{dict.plans.annualSave}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--paper)] py-16 lg:py-20">
        <div className="site-width">
          <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
            {paygCard}
            {card("growth", dict.plans.recommended)}
            {card("scale")}
          </div>
          <p className="prospect-note">{t.noCommitment}</p>
          <p className="prospect-note estimate-note">{t.card.estimate}</p>
        </div>
      </section>

      <section id="compare" className="border-t border-[var(--line)] bg-[var(--soft)] py-20 lg:py-28">
        <div className="site-width">
          <div className="max-w-2xl">
            <p className="eyebrow">{t.comparisonEyebrow}</p>
            <h2 className="display-font mt-4 text-[clamp(2.45rem,5vw,4.2rem)] font-semibold leading-[1.04] tracking-[-.05em]">{t.comparisonTitle}</h2>
            <p className="mt-5 max-w-xl text-[1.03rem] leading-8 text-[var(--muted)]">{t.comparisonCopy}</p>
          </div>
          <div className="comparison-wrap mt-11">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>{t.feature}</th>
                  {min && <th>{t.payg.name}</th>}
                  {tiers.map((p) => <th key={p}>{planName(p, dict)}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="section-row"><td colSpan={tiers.length + 2}>{t.coreFeatures}</td></tr>
                {featureKeys.map((k) => (
                  <tr key={k}>
                    <td>{t.features[k]}</td>
                    {min && <td><span className="included"><Check width={16} height={16} /><span>{t.included}</span></span></td>}
                    {tiers.map((i) => (
                      <td key={i}><span className="included"><Check width={16} height={16} /><span>{t.included}</span></span></td>
                    ))}
                  </tr>
                ))}
                <tr className="section-row"><td colSpan={tiers.length + 2}>{t.usageCapacity}</td></tr>
                <tr>
                  <td>{t.usageProspects}</td>
                  {min && <td>{t.payg.byCredit}</td>}
                  {tiers.map((p) => <td key={p}>{n(plans[p].prospects)}</td>)}
                </tr>
                <tr>
                  <td>{t.usageContacts}</td>
                  {min && <td>{dict.plans.unlimited}</td>}
                  {tiers.map((p) => <td key={p}>{dict.plans.unlimited}</td>)}
                </tr>
                <tr>
                  <td>{t.usageEmails}</td>
                  {min && <td>{dict.plans.unlimited}</td>}
                  {tiers.map((p) => <td key={p}>{dict.plans.unlimited}</td>)}
                </tr>
                <tr>
                  <td>{t.price}</td>
                  {min && <td dir="auto" className="text-start">{fmt(t.payg.from, { amount: usd(min.priceUsd) })}</td>}
                  {tiers.map((p) => <td key={p} className="text-start"><span dir="ltr">{price(p)}</span> {t.perMonth}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[var(--paper)] py-20 lg:py-28">
        <div className="site-width pricing-narrow">
          <div className="text-center">
            <p className="eyebrow">{t.faqEyebrow}</p>
            <h2 className="display-font mt-4 text-[clamp(2.45rem,5vw,4.2rem)] font-semibold leading-[1.04] tracking-[-.05em]">{t.faqTitle}</h2>
          </div>
          <div className="mt-10">
            {pricingFaq(t, trialDays).map(([q, a]) => <FaqItem key={q} q={q} a={a} />)}
          </div>
        </div>
      </section>

      <section id="signup" className="final-section py-20 lg:py-28">
        <div className="site-width">
          <div className="grid items-center gap-12 lg:grid-cols-[.95fr_1.05fr]">
            <div>
              <p className="eyebrow text-[#ff7772]!">{t.finalEyebrow}</p>
              <h2 className="display-font mt-4 max-w-xl text-[clamp(2.8rem,5vw,4.6rem)] font-semibold leading-[1.02] tracking-[-.055em] text-white">{t.finalTitle}</h2>
            </div>
            <SignupPanel t={t} signedIn={signedIn} />
          </div>
        </div>
      </section>
    </>
  );
}

type Item = { text: string; help: string };

function PlanCard({ name, price, note, billed, items, href, cta, foot, recommended, onPick }: {
  name: string; price: string; note: string; billed?: string; items: Item[]; href: string; cta: string; foot: string; recommended?: string; onPick?: () => void;
}) {
  return (
    <article className={`pricing-card${recommended ? " recommended" : ""}`}>
      {recommended && <span className="recommended-label">{recommended}</span>}
      <h2 className="plan-name">{name}</h2>
      <p className="price" dir="ltr">{price}</p>
      <p className="price-note">{note}</p>
      {billed && <p className="price-billed" dir="auto">{billed}</p>}
      <div className="plan-divider" />
      <ul className="plan-list">
        {items.map((item, i) => (
          <li key={item.text}>
            <Check width={17} height={17} />
            <span>{i === 0 ? <strong>{item.text}</strong> : item.text}</span>
            <span className="plan-help" tabIndex={0} role="button" aria-label={item.help}><CircleAlert width={14} height={14} /><span role="tooltip">{item.help}</span></span>
          </li>
        ))}
      </ul>
      <Link className={`${recommended ? "primary-button" : "outline-button"} focus-ring mt-auto w-full`} href={href} onClick={onPick}>{cta}</Link>
      <p className="plan-foot">{foot}</p>
    </article>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`faq-item${open ? " open" : ""}`}>
      <button className="faq-trigger focus-ring" type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{q}</span>
        <Plus className="faq-icon" width={20} height={20} />
      </button>
      <div className="faq-answer">{a}</div>
    </article>
  );
}

// Final-section form: creates a real Yolias account (magic link). Name and
// company are stored and pre-fill onboarding.
function SignupPanel({ t, signedIn }: { t: PricingCopy; signedIn: boolean }) {
  const dict = useI18n().t;
  const [status, setStatus] = useState<{ kind: "error" | "success" | "loading"; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (signedIn) {
    return (
      <div className="form-panel p-6 sm:p-8">
        <h3 className="text-2xl font-bold tracking-[-.035em]">{t.formTitle}</h3>
        <Link className="primary-button focus-ring mt-6 w-full" href="/">{t.continue}</Link>
      </div>
    );
  }

  return (
    <div className="form-panel p-6 sm:p-8">
      <h3 className="text-2xl font-bold tracking-[-.035em]">{t.formTitle}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t.formIntro}</p>
      <form
        className="mt-6 space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          if (!form.checkValidity()) {
            form.reportValidity();
            setStatus({ kind: "error", text: t.validationError });
            return;
          }
          const fd = new FormData(form);
          setStatus({ kind: "loading", text: t.loading });
          start(async () => {
            const r = await sendMagicLink("signup", { status: "idle" }, fd);
            if (r.status === "sent") setStatus({ kind: "success", text: fmt(t.sent, { email: r.email }) });
            else if (r.status === "error") setStatus({ kind: "error", text: r.message });
          });
        }}
      >
        <div>
          <label className="mb-2 block text-sm font-bold" htmlFor="full-name">{t.nameLabel}</label>
          <input className="form-field" id="full-name" name="full_name" type="text" required autoComplete="name" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-bold" htmlFor="work-email">{t.emailLabel}</label>
          <input className="form-field" id="work-email" name="email" type="email" dir="ltr" required autoComplete="email" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-bold" htmlFor="company-name">{t.companyLabel}</label>
          <input className="form-field" id="company-name" name="company" type="text" required autoComplete="organization" />
        </div>
        <input type="hidden" name="consent" value="1" />
        <p className="signup-consent">
          <ConsentText text={dict.auth.consent} links={{ terms: { href: "/legal/terms", label: dict.auth.consentTerms }, privacy: { href: "/legal/privacy", label: dict.auth.consentPrivacy } }} />
        </p>
        <button className="primary-button focus-ring w-full" type="submit" disabled={pending}>
          <span>{pending ? t.loading : t.submit}</span>
        </button>
        {status && <p className={`status-message status-${status.kind}`} role="status" aria-live="polite">{status.text}</p>}
      </form>
    </div>
  );
}
