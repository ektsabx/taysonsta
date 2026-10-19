import { YoliasMark } from "@/components/YoliasMark";
import { flagEmoji } from "@/lib/country-codes";
import type { DirectoryPartner } from "@/lib/affiliates/directory";
import type { Locale } from "@/lib/i18n/config";
import type { affiliatesPage } from "@/lib/content/affiliates-page";

type Copy = (typeof affiliatesPage)["en"];

// "Our certified partner network" (owner brief 2026-10-19): one card per
// listed partner — photo (or the Yolias mark), name, role, country, level and
// success rate. Data from lib/affiliates/directory.ts, never typed by hand.
export function PartnerNetwork({ partners, locale, c, roles }: { partners: DirectoryPartner[]; locale: Locale; c: Copy; roles: Record<string, string> }) {
  const countries = new Intl.DisplayNames([locale === "ar" ? "ar" : "en"], { type: "region" });
  return (
    <section className="section" id="network">
      <div className="site-width">
        <div className="section-head"><h2 className="display-font">{c.network.title}</h2><p>{c.network.lead}</p></div>
        {partners.length === 0 ? (
          <p className="partner-network-empty">{c.network.empty}</p>
        ) : (
          <ul className="partner-network">
            {partners.map((p) => (
              <li key={p.id} className="partner-card">
                <div className="partner-card-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.photo ? <img src={p.photo} alt="" width={72} height={72} loading="lazy" /> : <span className="partner-card-mark"><YoliasMark size={34} /></span>}
                </div>
                <strong className="partner-card-name" dir="auto">{p.name}</strong>
                {p.role && <span className="partner-card-role">{roles[p.role]}</span>}
                {p.country && <span className="partner-card-country"><span aria-hidden="true">{flagEmoji(p.country)}</span> {countries.of(p.country)}</span>}
                <dl className="partner-card-stats">
                  <div><dt>{c.network.level}</dt><dd><span className={`partner-tier ${p.tier}`}>{c.network.tiers[p.tier]}</span></dd></div>
                  <div><dt>{c.network.success}</dt><dd dir="ltr">{p.rate == null ? <span className="partner-card-new">{c.network.newPartner}</span> : `${p.rate}%`}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        )}
        <p className="solution-note">{c.network.tiersNote}</p>
      </div>
    </section>
  );
}
