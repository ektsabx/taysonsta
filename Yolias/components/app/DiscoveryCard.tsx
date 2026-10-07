import { CheckCircle2, CircleAlert, Clock, Target, TrendingUp, UserRound } from "lucide-react";
import { criteriaLine, parseIcp, sizeLabel } from "@/lib/discovery/icp";
import { isActive } from "@/lib/discovery/states";
import { countryLabel, formatNumber, location } from "@/lib/format";
import { fmt, type Dictionary, type Locale } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import type { StrategyView } from "@/services/strategies";
import type { Json } from "@/types/database";
import { YoliasMark } from "@/components/YoliasMark";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CompanyLogo, PersonAvatar } from "./Media";
import { BuyMoreProspectsButton, RetryStrategyButton, SaveToProspectsButton } from "./DiscoveryActions";
import { ChannelBadges } from "./ChannelBadges";
import { CampaignSetup } from "./CampaignSetup";
import { ContactCell } from "./ProspectBits";
import { maskEmail, maskPhone } from "@/services/prospects";

// Renders a campaign event in the reader's language when it carries a
// dictionary key (meta.key), otherwise its stored text.
function eventText(message: string, meta: Json | null, t: Dictionary, locale: Locale, criteria: string): string {
  const m = meta as { key?: string; vars?: Record<string, string | number> } | null;
  if (!m?.key || !(m.key in t.events)) return message;
  const vars: Record<string, string | number> = { ...(m.vars ?? {}) };
  if (m.key === "plan") {
    vars.unit = t.discovery[(vars.unitKey as "unitCompanies" | "unitProspects") ?? "unitCompanies"];
    vars.criteria = criteria;
    vars.sources = vars.sources || t.events.noSources;
    vars.count = formatNumber(Number(vars.count), locale);
  }
  return fmt(t.events[m.key as keyof Dictionary["events"]], vars);
}

// The "Customer Discovery" artifact under the Yolias AI prompt. Shows the
// discovered target account and decision makers once a campaign has results;
// before that, the understood criteria (ICP) and the campaign's latest activity.
export async function DiscoveryCard({ view }: { view: StrategyView }) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const d = t.discovery;
  const { strategy, campaign, topCompany, topProspects, topResults, lastEvent, savedCount } = view;

  if (strategy.status === "failed") {
    const key = strategy.error as keyof Dictionary["strategy"]["errors"] | null;
    const message = key && key in t.strategy.errors ? t.strategy.errors[key] : strategy.error ?? t.strategy.errors.aiFailed;
    return (
      <div className="agent-artifact-card">
        <div className="artifact-badge-top">
          <div className="artifact-status failed"><CircleAlert /><span>{d.needsAttention}</span></div>
        </div>
        <p className="artifact-note">{message}</p>
        <div className="artifact-actions">
          <span className="artifact-note">{d.savedRetry}</span>
          <RetryStrategyButton strategyId={strategy.id} />
        </div>
      </div>
    );
  }

  const icp = parseIcp(campaign?.criteria ?? strategy.icp);
  if (strategy.status === "setup" && icp && !campaign) return <CampaignSetup strategyId={strategy.id} icp={icp} />;
  if (!icp || !campaign) {
    return (
      <div className="agent-artifact-card">
        <div className="artifact-badge-top">
          <div className="artifact-status pending"><YoliasMark size={16} thinking /><span className="shimmer-text">{d.understanding}</span></div>
        </div>
      </div>
    );
  }

  const criteria = criteriaLine(icp, locale, t.icp);
  const people = campaign.search_type === "people";
  const hasResults = people ? topCompany !== null && topProspects.length > 0 : topResults.length > 0;
  const status = hasResults && campaign.status === "completed"
    ? { cls: "", icon: <CheckCircle2 />, text: d.complete }
    : campaign.status === "partial"
      ? { cls: "", icon: <CheckCircle2 />, text: campaign.partial_reason === "no_matches" ? d.partialNone : d.partial }
    : isActive(campaign.status)
      ? { cls: "pending", icon: <YoliasMark size={16} thinking />, text: d.discovering }
      : campaign.status === "failed"
        ? { cls: "failed", icon: <CircleAlert />, text: d.stopped }
        : campaign.status === "awaiting_source"
          ? { cls: "pending", icon: <Clock />, text: d.awaitingSource }
          : campaign.status === "paused"
            ? { cls: campaign.partial_reason === "quota" ? "failed" : "pending", icon: campaign.partial_reason === "quota" ? <CircleAlert /> : <Clock />, text: campaign.partial_reason === "quota" ? d.pausedQuota : d.paused }
            : { cls: "", icon: <CheckCircle2 />, text: d.complete };
  const outOfProspects = campaign.status === "paused" && campaign.partial_reason === "quota";

  const topScore = people ? topProspects[0]?.match_score : topResults[0]?.match_score;
  const unit = icp.target_unit === "companies" ? d.unitCompanies : d.unitProspects;

  return (
    <div className="agent-artifact-card">
      <div className="artifact-badge-top">
        <div className={`artifact-status ${status.cls}`}>
          {status.icon}
          <span>{status.text}</span>
        </div>
        <span className="artifact-meta">
          {hasResults && topScore != null ? fmt(d.matchScore, { score: topScore }) : fmt(d.target, { count: formatNumber(icp.target_count, locale), unit })}
        </span>
      </div>

      <div className="artifact-grid">
        {hasResults && !people ? (
          <>
            <div className="artifact-box">
              <div className="artifact-box-title">{d.targetCriteria}</div>
              <div className="company-title">{campaign.name}</div>
              <div className="company-sub">{criteria}</div>
              <div className="company-detail">{t.searchTypes[campaign.search_type]}{icp.lookalike_seeds.length ? ` · ${icp.lookalike_seeds.join(", ")}` : ""}</div>
            </div>
            <div className="artifact-box">
              <div className="artifact-box-title">{campaign.search_type === "local_businesses" ? d.topPlaces : d.topCompanies}</div>
              {topResults.map((c) => (
                <div className="contact-item-row" key={c.id}>
                  <CompanyLogo name={c.name} logoUrl={c.logo_url} domain={c.domain} size={30} />
                  <div style={{ flex: 1 }}>
                    <div className="contact-name">{c.name}</div>
                    <div className="contact-role">{[c.kind === "local_business" ? c.category : c.industry, location(c.city, c.country, locale)].filter(Boolean).join(" · ")}</div>
                  </div>
                  {c.match_score != null && <span className="match-good">{c.match_score}%</span>}
                </div>
              ))}
            </div>
          </>
        ) : hasResults && topCompany ? (
          <div className="artifact-box">
            <div className="artifact-box-title">{d.matchedAccount}</div>
            <div className="company-title-row"><CompanyLogo name={topCompany.name} logoUrl={topCompany.logo_url} domain={topCompany.domain} size={34} /><div className="company-title">{topCompany.name}</div></div>
            <div className="company-sub">
              {[topCompany.industry, location(topCompany.city, topCompany.country, locale)].filter(Boolean).join(" · ")}
            </div>
            <div className="company-detail">
              {[
                topCompany.employee_count != null && fmt(d.headcount, { count: formatNumber(topCompany.employee_count, locale) }),
                topCompany.funding_stage,
              ].filter(Boolean).join(" · ")}
            </div>
            {topCompany.hiring_roles ? (
              <div className="context-tag"><TrendingUp /><span>{fmt(d.hiringRoles, { count: topCompany.hiring_roles })}</span></div>
            ) : null}
          </div>
        ) : (
          <div className="artifact-box">
            <div className="artifact-box-title">{d.targetCriteria}</div>
            <div className="company-title">{campaign.name}</div>
            <div className="company-sub">{criteria}</div>
            <div className="company-detail">
              {[
                icp.cities.length ? icp.cities.join(", ") : icp.countries.map((c) => countryLabel(c, locale)).join(", "),
                sizeLabel(icp, t.icp),
              ].filter(Boolean).join(" · ")}
            </div>
            {icp.hiring && (
              <div className="context-tag"><TrendingUp /><span>{d.currentlyHiring}{icp.hiring_roles.length ? `: ${icp.hiring_roles.join(", ")}` : ""}</span></div>
            )}
            {icp.funding_stages.length > 0 && (
              <div className="context-tag"><Target /><span>{icp.funding_stages.join(", ")}</span></div>
            )}
          </div>
        )}

        {hasResults && !people ? null : hasResults ? (
          <div className="artifact-box">
            <div className="artifact-box-title">{d.verifiedMakers}</div>
            {topProspects.map((p) => (
              <div className="contact-item-row" key={p.id}>
                <PersonAvatar name={p.full_name} photoUrl={p.photo_url} size={30} />
                <div style={{ flex: 1 }}>
                  <div className="contact-name">{p.full_name}</div>
                  <div className="contact-role">{p.title}</div>
                </div>
                {p.revealed_at ? <ChannelBadges prospect={p} /> : <ContactCell id={p.id} masked={{ email: p.email && p.email_status !== "invalid" ? maskEmail(p.email) : null, phone: p.phone ? maskPhone(p.phone) : null, verified: p.email_status === "verified" }} linkedin={p.linkedin_url} />}
              </div>
            ))}
          </div>
        ) : (
          <div className="artifact-box">
            <div className="artifact-box-title">{d.makersToFind}</div>
            {(icp.job_titles.length ? icp.job_titles : d.defaultTitles).slice(0, 4).map((title, i) => (
              <div className="contact-item-row" key={title}>
                <div className={`contact-avatar${i > 0 ? " alt" : ""}`}><UserRound /></div>
                <div style={{ flex: 1 }}>
                  <div className="contact-name">{title}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="artifact-actions">
        <span className="artifact-note">
          {hasResults
            ? fmt(d.savedTo, { name: campaign.name })
            : lastEvent
              ? eventText(lastEvent.message, lastEvent.meta, t, locale, criteria)
              : fmt(d.created, { name: campaign.name })}
        </span>
        {hasResults && <Link className="artifact-results-link" href={`/prospects?${campaign.search_type === "local_businesses" ? "tab=local&" : ""}campaign=${campaign.id}`}>{t.results.viewAll} <ArrowRight className="flip-rtl" /></Link>}
        <SaveToProspectsButton campaignId={campaign.id} alreadySaved={hasResults && savedCount >= campaign.prospects_found} disabled={!hasResults} />
      </div>
      {outOfProspects && (
        <div className="artifact-buy-more">
          <BuyMoreProspectsButton />
        </div>
      )}
    </div>
  );
}
