import type { HomeContent } from "@/content/home";

export function WhyTaysonsta({ content }: { content: HomeContent["whyUs"] }) {
  return (
    <section className="ed-section surface" id="about">
      <div className="ed-section-inner">
        <div className="ed-section-head">
          <h2>{content.heading}</h2>
          <p>{content.subtitle}</p>
        </div>

        <div className="ed-pillars">
          {content.items.map((item) => (
            <div className="ed-pillar" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
