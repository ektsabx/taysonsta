import type { HomeContent } from "@/content/home";
import type { Locale } from "@/lib/i18n";

interface HowWeHelpProps {
  content: HomeContent["howWeHelp"];
  locale: Locale;
}

export function HowWeHelp({ content }: HowWeHelpProps) {
  return (
    <section className="ed-section" id="solutions">
      <div className="ed-section-inner">
        <div className="ed-section-head">
          <h2>{content.heading}</h2>
          <p>{content.subtitle}</p>
        </div>

        <div className="ed-rows">
          {content.items.map((item, index) => (
            <div className="ed-row" key={item.title}>
              <span className="ed-row-num">{String(index + 1).padStart(2, "0")}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
