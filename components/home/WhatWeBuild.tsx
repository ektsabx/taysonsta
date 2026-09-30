import type { HomeContent } from "@/content/home";

export function WhatWeBuild({ content }: { content: HomeContent["whatWeBuild"] }) {
  return (
    <section className="ed-section surface">
      <div className="ed-section-inner">
        <div className="ed-section-head">
          <h2>{content.heading}</h2>
          <p>{content.subtitle}</p>
        </div>

        <div className="ed-capabilities-grid">
          {content.items.map((item) => (
            <div className="ed-capability-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
