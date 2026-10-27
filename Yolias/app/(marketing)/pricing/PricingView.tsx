"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "@/components/LocaleLink";
import { Check, Plus } from "lucide-react";
import { sendMagicLink } from "@/app/(auth)/actions";
import { ConsentText } from "@/app/(auth)/ConsentText";
import { formatMoney, formatNumber } from "@/lib/format";
import { fmt, type Dictionary } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { TrustLogos } from "@/components/marketing/SocialProof";
import { planName, planPrice, type PlanTerms } from "@/lib/plans";
import type { Currency, PaidPlan } from "@/types/database";
import { funnelEvent } from "@/lib/funnel-client";
import { pricingFaq } from "@/lib/pricing-copy";

type PricingCopy = Dictionary["pricing"];
type PlanId = PaidPlan;

// Pay As You Go, Pro and Growth (owner brief 2026-10-20, D-247): prepaid
// credit or one of two monthly plans, no annual billing, no free credit. The
// prospect is the only unit. Every number comes from the configuration the
// limits are enforced with (plan_quotas, prospect_packs).
const tiers: PlanId[] = ["pro", "growth"];

// Features on every plan. CRM, pipelines and deals are listed at the owner's
// request ahead of the CRM module (docs/21).
const featureKeys = ["aiSalesAgent", "aiLeadGeneration", "campaigns", "teamWorkspace", "crm", "enrichment", "analytics", "integrations", "chatSupport", "unlimitedUsers"] as const;

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
  const n = (v: number) => formatNumber(v, locale);
  // Monthly prices only. Visitors from Egypt see the EGP prices they are charged (D-237).
  const list = (plan: PlanId) => planPrice(plans[plan], currency) ?? 0;
  // USD everywhere (owner, 2026-10-21); visitors from Egypt see the EGP charge in checkout.
  void egp;
  const price = (plan: PlanId) => formatMoney(list(plan), currency);
  const usd = (v: number) => formatMoney(v, "USD");
  // The same features on every card (owner, 2026-10-21).
  const shared = [dict.plans.contactsUnlimited, t.features.teamWorkspace, t.features.crm, t.features.enrichment, t.features.chatSupport, t.unlimitedUsers];

  // Picking a plan → signup (new visitors) or checkout (signed in).
  const href = (plan: PlanId | "payg") => `${signedIn ? "/checkout" : "/signup"}?plan=${plan}`;
  // Journey tracking (D-212): the plans were seen; a plan was picked.
  useEffect(() => { funnelEvent("plans_viewed"); }, []);
  const min = topUps[0];
  const paygCard = min ? (
    <PlanCard
      key="payg"
      onPick={() => funnelEvent("plan_selected", { plan: "payg" })}
      name={t.payg.name}
      price={usd(min.priceUsd)}
      note={t.payg.note}
      items={[t.payg.noExpiry, ...shared]}
      href={href("payg")}
      cta={t.payg.cta}
      foot={t.payg.foot}
    />
  ) : null;
  const card = (plan: PlanId, recommended?: string) => (
    <PlanCard
      key={plan}
      onPick={() => funnelEvent("plan_selected", { plan, period: "monthly" })}
      name={planName(plan, dict)}
      price={price(plan)}
      note={t.perMonth}
      items={[
        fmt(dict.plans.prospectsPerMonth, { count: n(plans[plan].prospects) }),
        ...shared,
      ]}
      href={href(plan)}
      cta={trialDays ? t.startTrial : t.getStarted}
      foot={trialDays ? fmt(t.trialFoot, { days: n(trialDays) }) : t.paidFoot}
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
            <p className="hero-copy">{t.heroSupport}{trialDays ? ` ${fmt(t.heroTrial, { days: n(trialDays) })}` : ""}</p>
          </div>
        </div>
      </section>

      <section className="bg-[var(--paper)] py-16 lg:py-20">
        <div className="site-width">
          <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
            {paygCard}
            {card("pro")}
            {card("growth", dict.plans.recommended)}
          </div>
          <p className="prospect-note">{t.noCommitment}</p>
          <TrustLogos locale={locale} />
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
        <div className="site-width max-w-[900px]">
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

function PlanCard({ name, price, note, billed, items, href, cta, foot, recommended, onPick }: {
  name: string; price: string; note: string; billed?: string; items: string[]; href: string; cta: string; foot: string; recommended?: string; onPick?: () => void;
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
          <li key={item}><Check width={17} height={17} /><span>{i === 0 ? <strong>{item}</strong> : item}</span></li>
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
