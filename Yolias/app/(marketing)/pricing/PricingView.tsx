"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Check, Plus } from "lucide-react";
import { sendMagicLink } from "@/app/(auth)/actions";
import { formatMoney, formatNumber } from "@/lib/format";
import { fmt, type Dictionary } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { planName, planPrice, priceFor, type PlanTerms } from "@/lib/plans";
import type { BillingPeriod, Currency, Plan } from "@/types/database";

type PricingCopy = Dictionary["pricing"];
type PlanId = Plan;

// Features that apply to Yolias today (customer discovery). Outreach, CRM and
// support items from the original design were removed on purpose.
const tiers: PlanId[] = ["free", "pro", "growth"];

const featureKeys = ["aiSalesAgent", "aiLeadGeneration", "campaigns", "analytics", "integrations", "unlimitedUsers"] as const;

interface Props {
  signedIn: boolean;
  /** Monthly prices and prospects per plan (lib/plan-catalog.ts). */
  plans: Record<PlanId, PlanTerms>;
  /** Egypt → EGP, every other country → USD (lib/plans.ts pricingCurrency). */
  currency: Currency;
}

export function PricingView({ signedIn, plans, currency }: Props) {
  const { t: dict, locale } = useI18n();
  const t = dict.pricing;
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const n = (v: number) => formatNumber(v, locale);
  const price = (plan: PlanId) => formatMoney(priceFor(planPrice(plans[plan], currency) ?? 0, period), currency);

  // Picking a plan → signup (new visitors) or checkout (signed in), keeping the period.
  const href = (plan: PlanId) => `${signedIn ? "/checkout" : "/signup"}?plan=${plan}&period=${period}`;
  const card = (plan: PlanId, recommended?: string) => (
    <PlanCard
      t={t}
      name={planName(plan, dict)}
      price={price(plan)}
      note={plan === "free" ? t.freeForever : period === "annual" ? t.perYear : t.perMonth}
      usage={fmt(plan === "free" ? dict.plans.prospectsOnce : dict.plans.prospectsPerMonth, { count: n(plans[plan].prospects) })}
      href={href(plan)}
      cta={plan === "free" ? t.startFree : t.tryYolias}
      foot={plan === "free" ? t.noCardSetup : t.setupMinutes}
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
            <div className="period-toggle" role="radiogroup" aria-label={t.billingPeriod}>
              {(["monthly", "annual"] as BillingPeriod[]).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={period === p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>
                  {p === "monthly" ? dict.plans.monthly : dict.plans.annual}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--paper)] py-16 lg:py-20">
        <div className="site-width">
          <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
            {card("free")}
            {card("pro")}
            {card("growth", dict.plans.recommended)}
          </div>
          <p className="prospect-note">{t.noCommitment}</p>
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
                  {tiers.map((p) => <th key={p}>{planName(p, dict)}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="section-row"><td colSpan={4}>{t.coreFeatures}</td></tr>
                {featureKeys.map((k) => (
                  <tr key={k}>
                    <td>{t.features[k]}</td>
                    {[0, 1, 2].map((i) => (
                      <td key={i}><span className="included"><Check width={16} height={16} /><span>{t.included}</span></span></td>
                    ))}
                  </tr>
                ))}
                <tr className="section-row"><td colSpan={4}>{t.usageCapacity}</td></tr>
                <tr>
                  <td>{t.usageProspects}</td>
                  {tiers.map((p) => <td key={p}>{n(plans[p].prospects)}</td>)}
                </tr>
                <tr>
                  <td>{t.price}</td>
                  {tiers.map((p) => <td key={p} dir="ltr" className="text-start">{price(p)}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[var(--paper)] py-20 lg:py-28">
        <div className="site-width max-w-[900px]">
          <div className="text-center">
            <p className="eyebrow">{t.faqEyebrow}</p>
            <h2 className="display-font mt-4 text-[clamp(2.45rem,5vw,4.2rem)] font-semibold leading-[1.04] tracking-[-.05em]">{t.faqTitle}</h2>
          </div>
          <div className="mt-10">
            {t.faq.map(([q, a]) => <FaqItem key={q} q={q} a={a} />)}
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

function PlanCard({ t, name, price, note, usage, href, cta, foot, recommended }: {
  t: PricingCopy; name: string; price: string; note: string; usage: string; href: string; cta: string; foot: string; recommended?: string;
}) {
  return (
    <article className={`pricing-card${recommended ? " recommended" : ""}`}>
      {recommended && <span className="recommended-label">{recommended}</span>}
      <h2 className="plan-name">{name}</h2>
      <p className="price" dir="ltr">{price}</p>
      <p className="price-note">{note}</p>
      <div className="plan-divider" />
      <ul className="plan-list">
        <li><Check width={17} height={17} /><span><strong>{usage}</strong></span></li>
        <li><Check width={17} height={17} /><span>{t.sameFeatures}</span></li>
        <li><Check width={17} height={17} /><span>{t.unlimitedUsers}</span></li>
      </ul>
      <Link className={`${recommended ? "primary-button" : "outline-button"} focus-ring mt-auto w-full`} href={href}>{cta}</Link>
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
  const [status, setStatus] = useState<{ kind: "error" | "success" | "loading"; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (signedIn) {
    return (
      <div className="form-panel p-6 sm:p-8">
        <h3 className="text-2xl font-bold tracking-[-.035em]">{t.formTitle}</h3>
        <Link className="primary-button focus-ring mt-6 w-full" href="/">{t.continue}<ArrowRight className="flip-rtl" width={17} height={17} /></Link>
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
        <button className="primary-button focus-ring w-full" type="submit" disabled={pending}>
          <span>{pending ? t.loading : t.submit}</span>
          <ArrowRight className="flip-rtl" width={17} height={17} />
        </button>
        {status && <p className={`status-message status-${status.kind}`} role="status" aria-live="polite">{status.text}</p>}
      </form>
    </div>
  );
}
