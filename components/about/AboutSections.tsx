import Image from "next/image";
import type { AboutContent } from "@/content/about";
import type { HomeContent } from "@/content/home";
import { localizedPath, type Locale } from "@/lib/i18n";
import { storageUrl } from "@/lib/storage";
import { Prose } from "@/components/ui/Prose";
import { FinalCtaBanner } from "@/components/ui/FinalCtaBanner";

export function AboutIntro({ content }: { content: AboutContent["intro"] }) {
  return (
    <div className="about-hero">
      <div className="sec-inner">
        <h1 className="about-hero-heading">{content.heading}</h1>
        <div className="about-hero-prose">
          <Prose paragraphs={content.paragraphs} />
        </div>
      </div>
    </div>
  );
}

export function AboutStory({ content }: { content: AboutContent["story"] }) {
  return (
    <div className="sec-dark">
      <div className="sec-inner">
        <h2 className="sec-h2">{content.heading}</h2>
        <Prose paragraphs={content.paragraphs} />
      </div>
    </div>
  );
}

export function AboutFounder({ content }: { content: AboutContent["founder"] }) {
  return (
    <section className="ed-section">
      <div className="ed-section-inner">
        <div className="ed-section-head">
          <h2>{content.heading}</h2>
        </div>
        <div className="ed-founder-grid">
          <div className="ed-founder-portrait">
            <Image src={storageUrl("img/founder.png")} alt={content.name} width={480} height={600} />
            <div className="ed-founder-portrait-meta">
              <span>{content.name.toUpperCase()}</span>
              <span>FOUNDER // TAYSONSTA</span>
            </div>
          </div>
          <div className="ed-founder-text">
            <h2>{content.name}</h2>
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

export function AboutVision({ content }: { content: AboutContent["vision"] }) {
  return (
    <section className="sec-dark">
      <div className="sec-inner">
        <h2 className="sec-h2">{content.heading}</h2>
        <Prose paragraphs={content.paragraphs} />
      </div>
    </section>
  );
}

export function AboutBrandStatement({ content }: { content: AboutContent["brand"] }) {
  return (
    <div className="about-brand-statement">
      <h2>{content.name}</h2>
      <p>{content.tagline}</p>
    </div>
  );
}

export function AboutClosing({ content, locale }: { content: HomeContent["finalCta"]; locale: Locale }) {
  return (
    <FinalCtaBanner
      heading={content.heading}
      body={content.body}
      ctaLabel={content.cta}
      ctaHref={localizedPath(locale, "/booking")}
    />
  );
}
