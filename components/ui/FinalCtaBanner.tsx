import Link from "next/link";

interface FinalCtaBannerProps {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}

export function FinalCtaBanner({ heading, body, ctaLabel, ctaHref }: FinalCtaBannerProps) {
  return (
    <section className="ed-section ed-final-cta">
      <div className="ed-section-inner">
        <h2>{heading}</h2>
        <p>{body}</p>
        <div className="ed-final-cta-ctas">
          <Link href={ctaHref} className="ed-btn ed-btn-primary">
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
