import type { Metadata } from "next";
import { RangePicker } from "@/components/app/RangePicker";
import { formatDate, formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requirePartner } from "@/lib/partners";
import { affiliateFor, applyAffiliate, currentProgram, dashboard } from "@/lib/affiliates";
import { commissionLabel, formatCents } from "@/lib/affiliates/program";
import Link from "next/link";
import { PartnerProfile, PartnerStart, PayoutPanel, ReferralLink } from "./AffiliateClient";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).affiliate.title} | Yolias`, robots: { index: false } };
}

const rangeDays = { "30d": 30, "90d": 90, "365d": 365, all: null } as const;
type RangeKey = keyof typeof rangeDays;
const TABS = ["overview", "referrals", "commissions", "payouts", "profile"] as const;
type Tab = (typeof TABS)[number];

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200").replace(/\/$/, "");
}

// Yolias Partners (D-178, D-206, D-210): its own sign-in, no subscription and
// no application — accept the terms and get the referral link at once. The
// dashboard: the partner's card (photo, name, code, commission), then
// Overview, Referrals, Commissions, Payouts (payout method + withdrawals) and
// Profile. Every number comes from the database.
export default async function PartnersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePartner();
  const session = { userId: user.id };
  const sp = await searchParams;
  const range: RangeKey = typeof sp.range === "string" && sp.range in rangeDays ? (sp.range as RangeKey) : "90d";
  const page = Math.max(1, Math.min(500, Number(sp.page) || 1));
  const tab: Tab = typeof sp.tab === "string" && (TABS as readonly string[]).includes(sp.tab) ? (sp.tab as Tab) : "overview";
  const [t, locale, program, found] = await Promise.all([getDictionary(), getLocale(), currentProgram(), affiliateFor(session.userId)]);
  // Joined from /partners/join (terms accepted there): start straight away.
  let affiliate = found;
  if (!affiliate && program?.settings.enabled && user.meta.partner_terms === program.termsVersion) {
    await applyAffiliate({ id: user.id, email: user.email }, { answers: {}, acceptedTerms: program.termsVersion, ip: null });
    affiliate = await affiliateFor(user.id);
  }
  const a = t.affiliate;
  const n = (v: number) => formatNumber(v, locale);
  const money = (cents: number) => <span dir="ltr">{formatCents(cents)}</span>;

  const header = (actions?: React.ReactNode) => (
    <header className="view-header">
      <div className="view-title-group">
        <h2>{a.title}</h2>
        <p>{a.subtitle}</p>
      </div>
      {actions ? <div className="view-actions">{actions}</div> : null}
    </header>
  );

  if (!affiliate) {
    const s = program?.settings;
    return (
      <div className="page-view">
        {header()}
        <div className="view-content-padding affiliate-page">
          {!program || !s?.enabled ? <p className="panel-empty">{a.closed}</p> : (
            <PartnerStart
              termsVersion={program.termsVersion}
              terms={program.terms}
              earn={fmt(a.apply.earn, {
                rate: commissionLabel(s, formatCents),
                recurring: !s.recurring.enabled ? a.apply.firstOnly : s.recurring.maxPayments ? fmt(a.apply.recurringFor, { count: n(s.recurring.maxPayments) }) : a.apply.recurringAlways,
                days: n(s.holdDays),
              })}
            />
          )}
        </div>
      </div>
    );
  }

  if (affiliate.status !== "approved") {
    return (
      <div className="page-view">
        {header()}
        <div className="view-content-padding affiliate-page">
          <section className="panel-card affiliate-status" role="status">
            <p>{a.status[affiliate.status]}</p>
            <p className="cell-sub">{fmt(a.status.submittedOn, { date: formatDate(affiliate.created_at, locale) })}</p>
            {affiliate.decision_reason && affiliate.status !== "pending" ? <p className="cell-sub">{fmt(a.status.reason, { reason: affiliate.decision_reason })}</p> : null}
          </section>
        </div>
      </div>
    );
  }

  const days = rangeDays[range];
  const since = days ? new Date(Date.now() - days * 86_400_000).toISOString() : "2020-01-01T00:00:00Z";
  const d = await dashboard(affiliate.id, { since, page });
  const s = program?.settings;
  const pct = (num: number, den: number) => (den ? `${Math.round((num / den) * 1000) / 10}%` : "-");
  const link = `${siteUrl()}/r/${affiliate.code}`;
  const openPayout = d.payouts.some((p) => ["requested", "approved", "processing"].includes(p.status));

  const qs = (p: number) => `?tab=${tab}&range=${range}&page=${p}`;
  const ranged = tab === "overview" || tab === "referrals" || tab === "commissions";
  const rate = s ? commissionLabel(s, formatCents) : "-";

  return (
    <div className="page-view">
      {header(ranged ? <RangePicker value={range} options={(Object.keys(rangeDays) as RangeKey[]).map((k) => ({ key: k, label: a.ranges[k] }))} /> : undefined)}
      <div className="view-content-padding affiliate-page">
        <nav className="ws-tabs partners-tabs" aria-label={a.title}>
          {TABS.map((k) => (
            <Link key={k} href={`?tab=${k}&range=${range}`} className={tab === k ? "active" : ""} aria-current={tab === k ? "page" : undefined}>{a.tabs[k]}</Link>
          ))}
        </nav>

        {tab === "overview" && (
          <>
            <ReferralLink link={link} howItWorks={s ? fmt(a.link.howItWorks, { days: n(s.attribution.days), model: s.attribution.model === "last_touch" ? a.link.lastTouch : a.link.firstTouch }) : ""} />
            <div className="stat-grid">
              {([
                [a.stats.visits, n(d.stats.visits), a.stats.visitsHint],
                [a.stats.signups, n(d.stats.signups), `${a.stats.conversion}: ${pct(d.stats.signups, d.stats.visits)}`],
                [a.stats.paying, n(d.stats.paying), `${a.stats.paidConversion}: ${pct(d.stats.paying, d.stats.signups)}`],
              ] as const).map(([label, value, note]) => (
                <div key={label} className="stat-card">
                  <div className="stat-label">{label}</div>
                  <div className="stat-value">{value}</div>
                  <div className="stat-note">{note}</div>
                </div>
              ))}
            </div>
            <div className="stat-grid">
              {([
                [a.balance.available, d.balances.available_cents, s ? fmt(a.balance.availableHint, { min: formatCents(s.minPayoutCents) }) : ""],
                [a.balance.pending, d.balances.pending_cents + d.balances.approved_cents, a.balance.pendingHint],
                [a.balance.processing, d.balances.processing_cents, ""],
                [a.balance.paid, d.balances.paid_cents, ""],
                [a.balance.reversed, d.balances.reversed_cents + d.balances.rejected_cents, d.balances.on_hold_cents ? `${a.balance.onHold}: ${formatCents(d.balances.on_hold_cents)}` : ""],
              ] as const).map(([label, cents, note]) => (
                <div key={label} className="stat-card">
                  <div className="stat-label">{label}</div>
                  <div className="stat-value">{money(cents)}</div>
                  {note ? <div className="stat-note">{note}</div> : null}
                </div>
              ))}
            </div>
            {s ? (
              <section className="panel-card">
                <h4 className="panel-title">{a.card.howTitle}</h4>
                <ul className="partners-how">
                  <li>{fmt(a.apply.earn, {
                    rate,
                    recurring: !s.recurring.enabled ? a.apply.firstOnly : s.recurring.maxPayments ? fmt(a.apply.recurringFor, { count: n(s.recurring.maxPayments) }) : a.apply.recurringAlways,
                    days: n(s.holdDays),
                  })}</li>
                  <li>{fmt(a.balance.availableHint, { min: formatCents(s.minPayoutCents) })}</li>
                  <li>{a.payout.manual}</li>
                </ul>
              </section>
            ) : null}
          </>
        )}

        {tab === "commissions" && (
          <section className="panel-card">
            <h4 className="panel-title">{a.tables.commissions}</h4>
            {d.commissions.length === 0 ? <p className="panel-empty">{a.tables.emptyCommissions}</p> : (
              <div className="data-table-scroll">
                <table className="data-table compact">
                  <thead><tr><th>{a.tables.date}</th><th>{a.tables.type}</th><th>{a.tables.base}</th><th>{a.tables.amount}</th><th>{a.tables.status}</th></tr></thead>
                  <tbody>
                    {d.commissions.map((c) => (
                      <tr key={c.id}>
                        <td>{formatDate(c.created_at, locale)}</td>
                        <td>{c.kind === "payment" ? fmt(a.tables.paymentN, { n: c.payment_seq ?? 1 }) : c.kind === "reversal" ? a.tables.reversal : a.tables.adjustment}</td>
                        <td>{c.base_cents ? money(c.base_cents) : "-"}</td>
                        <td>{money(c.amount_cents)}</td>
                        <td>
                          {a.commissionStatus[c.status]}
                          {c.on_hold && ["pending", "approved"].includes(c.status) ? <span className="cell-sub">{a.balance.onHold}</span> : null}
                          {c.status === "pending" ? <span className="cell-sub">{formatDate(c.available_at, locale)}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {d.commissionPages > 1 ? (
              <nav className="affiliate-pager" aria-label={a.tables.commissions}>
                {page > 1 ? <a className="btn-secondary" href={qs(page - 1)}>{a.tables.prev}</a> : <span />}
                <span className="cell-sub">{page} / {d.commissionPages}</span>
                {page < d.commissionPages ? <a className="btn-secondary" href={qs(page + 1)}>{a.tables.next}</a> : <span />}
              </nav>
            ) : null}
            <p className="cell-sub affiliate-note">{a.definitions}</p>
          </section>
        )}

        {tab === "payouts" && (
          <>
            {s ? (
              <PayoutPanel
                methods={s.payoutMethods.filter((m) => m.enabled)}
                method={affiliate.payout_method}
                details={affiliate.payout_details}
                availableCents={d.balances.available_cents}
                minCents={s.minPayoutCents}
                open={openPayout}
              />
            ) : null}
            <section className="panel-card">
              <h4 className="panel-title">{a.tables.payouts}</h4>
              {d.payouts.length === 0 ? <p className="panel-empty">{a.tables.emptyPayouts}</p> : (
                <div className="data-table-scroll">
                  <table className="data-table compact">
                    <thead><tr><th>{a.tables.date}</th><th>{a.tables.amount}</th><th>{a.tables.method}</th><th>{a.tables.status}</th><th>{a.tables.reference}</th></tr></thead>
                    <tbody>
                      {d.payouts.map((p) => (
                        <tr key={p.id}>
                          <td>{formatDate(p.requested_at, locale)}</td>
                          <td>{money(p.amount_cents)}</td>
                          <td>{s?.payoutMethods.find((m) => m.id === p.method)?.label ?? p.method}</td>
                          <td>
                            {a.payoutStatus[p.status]}
                            {p.reason && (p.status === "rejected" || p.status === "failed") ? <span className="cell-sub">{p.reason}</span> : null}
                          </td>
                          <td dir="ltr">{p.status === "paid" ? p.reference ?? "-" : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {tab === "referrals" && (
          <div className="analytics-grid">
            <section className="panel-card">
              <h4 className="panel-title">{a.tables.referrals}</h4>
              {d.referrals.length === 0 ? <p className="panel-empty">{a.tables.emptyReferrals}</p> : (
                <div className="data-table-scroll">
                  <table className="data-table compact">
                    <thead><tr><th>{a.tables.customer}</th><th>{a.tables.signedUp}</th><th>{a.tables.paying}</th></tr></thead>
                    <tbody>
                      {d.referrals.map((r) => (
                        <tr key={r.id}><td dir="ltr">{r.label}</td><td>{formatDate(r.signedUpAt, locale)}</td><td>{r.paying ? a.tables.yes : a.tables.no}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="panel-card">
              <h4 className="panel-title">{a.tables.campaigns}</h4>
              {d.campaigns.length === 0 ? <p className="panel-empty">{a.tables.emptyReferrals}</p> : (
                <div className="data-table-scroll">
                  <table className="data-table compact">
                    <thead><tr><th>{a.tables.campaign}</th><th>{a.stats.visits}</th><th>{a.stats.signups}</th></tr></thead>
                    <tbody>
                      {d.campaigns.map((c) => (
                        <tr key={c.campaign || "-"}><td dir="ltr">{c.campaign || a.tables.none}</td><td>{n(c.visits)}</td><td>{n(c.signups)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "profile" && <PartnerProfile userId={user.id} name={user.name} email={user.email} avatarUrl={user.avatarUrl} listing={affiliate ? { listed: affiliate.listed, role: affiliate.partner_role, country: affiliate.country } : null} />}
      </div>
    </div>
  );
}
