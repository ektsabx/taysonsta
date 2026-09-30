import Image from "next/image";
import type { HomeContent } from "@/content/home";
import { storageUrl } from "@/lib/storage";

export function FounderSection({ content }: { content: HomeContent["founder"] }) {
  return (
    <section className="ed-section surface">
      <div className="ed-section-inner">
        <div className="ed-founder-grid">
          <div className="ed-founder-portrait">
            <Image src={storageUrl("img/founder.png")} alt={content.name} width={480} height={600} />
            <div className="ed-founder-portrait-meta">
              <span>{content.name.toUpperCase()}</span>
              <span>FOUNDER // TAYSONSTA</span>
            </div>
          </div>

          <div className="ed-founder-text">
            <h2>{content.heading}</h2>
            {content.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <div className="ed-founder-sign">
              <strong>{content.name}</strong>
              <span>{content.title}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
