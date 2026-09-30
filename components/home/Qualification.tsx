import type { HomeContent } from "@/content/home";
import type { Locale } from "@/lib/i18n";

interface QualificationProps {
  content: HomeContent["qualification"];
  locale: Locale;
}

export function Qualification({ content, locale }: QualificationProps) {
  return (
    <section className="ed-section" id="clients">
      <div className="ed-section-inner">
        <div className="ed-section-head">
          {/* This heading is deliberately English in both locales; on the RTL
              page it needs its own LTR embedding so the trailing "?" doesn't
              get reordered by the Arabic bidi context, while staying
              right-aligned like the rest of the block. */}
          <h2 style={locale === "ar" ? { direction: "ltr", unicodeBidi: "isolate", textAlign: "right" } : undefined}>
            {content.heading}
          </h2>
          <p>{content.subtitle}</p>
        </div>

        <div className="ed-qualification-grid">
          <div className="ed-qualification-col">
            <div className="ed-qualification-head">
              <span className="ed-qualification-dot good" />
              <h3>{content.rightFitTitle}</h3>
            </div>
            <ul>
              {content.rightFit.map((line, index) => (
                <li key={line}>
                  <span className="ed-qualification-num">{String(index + 1).padStart(2, "0")}</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="ed-qualification-col">
            <div className="ed-qualification-head">
              <span className="ed-qualification-dot bad" />
              <h3>{content.wrongFitTitle}</h3>
            </div>
            <ul>
              {content.wrongFit.map((line, index) => (
                <li key={line}>
                  <span className="ed-qualification-num">{String(index + 1).padStart(2, "0")}</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
