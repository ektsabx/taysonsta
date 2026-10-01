import { CheckCircle2, CircleAlert, Clock, LoaderCircle, Target, TrendingUp, UserRound } from "lucide-react";
import { countryName, criteriaLine, parseIcp, sizeLabel } from "@/lib/discovery/icp";
import { initials, location } from "@/lib/format";
import type { StrategyView } from "@/services/strategies";
import { RetryStrategyButton, SaveToProspectsButton } from "./DiscoveryActions";
import { ChannelBadges } from "./ChannelBadges";

// The "Customer Discovery" artifact under the Yolias AI prompt. Shows the
// discovered target account and decision makers once a campaign has results;
// before that, the understood criteria (ICP) and the campaign's latest activity.
export function DiscoveryCard({ view }: { view: StrategyView }) {
  const { strategy, campaign, topCompany, topProspects, lastEvent, savedCount } = view;

  if (strategy.status === "failed") {
    return (
      <div className="agent-artifact-card">
        <div className="artifact-badge-top">
          <div className="artifact-status failed"><CircleAlert /><span>Strategy Needs Attention</span></div>
        </div>
        <p className="artifact-note">{strategy.error ?? "Yolias AI couldn't process this request."}</p>
        <div className="artifact-actions">
          <span className="artifact-note">Your request is saved. You can retry or edit it above and send again.</span>
          <RetryStrategyButton strategyId={strategy.id} />
        </div>
      </div>
    );
  }

  const icp = parseIcp(campaign?.criteria ?? strategy.icp);
  if (!icp || !campaign) {
    return (
      <div className="agent-artifact-card">
        <div className="artifact-badge-top">
          <div className="artifact-status pending"><LoaderCircle /><span>Understanding Your Strategy</span></div>
        </div>
      </div>
    );
  }

  const hasResults = topCompany !== null && topProspects.length > 0;
  const status = hasResults && campaign.status === "completed"
    ? { cls: "", icon: <CheckCircle2 />, text: "Customer Discovery Complete" }
    : campaign.status === "running" || campaign.status === "queued"
      ? { cls: "pending", icon: <LoaderCircle />, text: "Discovering Customers" }
      : campaign.status === "failed"
        ? { cls: "failed", icon: <CircleAlert />, text: "Discovery Stopped" }
        : campaign.status === "awaiting_source"
          ? { cls: "pending", icon: <Clock />, text: "Campaign Ready · Awaiting Data Source" }
          : { cls: "", icon: <CheckCircle2 />, text: "Customer Discovery Complete" };

  const topScore = topProspects[0]?.match_score;

  return (
    <div className="agent-artifact-card">
      <div className="artifact-badge-top">
        <div className={`artifact-status ${status.cls}`}>
          {status.icon}
          <span>{status.text}</span>
        </div>
        <span className="artifact-meta">
          {hasResults && topScore != null ? `Match Score: ${topScore}%` : `Target: ${icp.target_count} ${icp.target_unit}`}
        </span>
      </div>

      <div className="artifact-grid">
        {hasResults ? (
          <div className="artifact-box">
            <div className="artifact-box-title">01 — Matched Target Account</div>
            <div className="company-title">{topCompany.name}</div>
            <div className="company-sub">
              {[topCompany.industry, location(topCompany.city, topCompany.country)].filter(Boolean).join(" · ")}
            </div>
            <div className="company-detail">
              {[
                topCompany.employee_count != null && `Headcount: ${topCompany.employee_count} employees`,
                topCompany.funding_stage,
              ].filter(Boolean).join(" · ")}
            </div>
            {topCompany.hiring_roles ? (
              <div className="context-tag"><TrendingUp /><span>Hiring {topCompany.hiring_roles}+ roles</span></div>
            ) : null}
          </div>
        ) : (
          <div className="artifact-box">
            <div className="artifact-box-title">01 — Target Criteria</div>
            <div className="company-title">{campaign.name}</div>
            <div className="company-sub">{criteriaLine(icp)}</div>
            <div className="company-detail">
              {[
                icp.cities.length ? icp.cities.join(", ") : icp.countries.map(countryName).join(", "),
                sizeLabel(icp),
              ].filter(Boolean).join(" · ")}
            </div>
            {icp.hiring && (
              <div className="context-tag"><TrendingUp /><span>Currently hiring{icp.hiring_roles.length ? `: ${icp.hiring_roles.join(", ")}` : ""}</span></div>
            )}
            {icp.funding_stages.length > 0 && (
              <div className="context-tag"><Target /><span>{icp.funding_stages.join(", ")}</span></div>
            )}
          </div>
        )}

        {hasResults ? (
          <div className="artifact-box">
            <div className="artifact-box-title">02 — Verified Decision Makers</div>
            {topProspects.map((p, i) => (
              <div className="contact-item-row" key={p.id}>
                <div className={`contact-avatar${i > 0 ? " alt" : ""}`}>{initials(p.full_name)}</div>
                <div style={{ flex: 1 }}>
                  <div className="contact-name">{p.full_name}</div>
                  <div className="contact-role">{p.title}</div>
                </div>
                <ChannelBadges prospect={p} directWhatsApp />
              </div>
            ))}
          </div>
        ) : (
          <div className="artifact-box">
            <div className="artifact-box-title">02 — Decision Makers to Find</div>
            {(icp.job_titles.length ? icp.job_titles : ["Founders", "C-level executives"]).slice(0, 4).map((t, i) => (
              <div className="contact-item-row" key={t}>
                <div className={`contact-avatar${i > 0 ? " alt" : ""}`}><UserRound /></div>
                <div style={{ flex: 1 }}>
                  <div className="contact-name">{t}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="artifact-actions">
        <span className="artifact-note">
          {hasResults
            ? `Saved to campaign "${campaign.name}" with full contact records.`
            : lastEvent?.message ?? `Campaign "${campaign.name}" created.`}
        </span>
        <SaveToProspectsButton campaignId={campaign.id} alreadySaved={hasResults && savedCount >= campaign.prospects_found} disabled={!hasResults} />
      </div>
    </div>
  );
}
