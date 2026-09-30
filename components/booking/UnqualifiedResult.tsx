import type { BookingContent } from "@/content/booking";

export function UnqualifiedResult({ content }: { content: BookingContent["unqualified"] }) {
  return (
    <div className="result-page">
      <svg className="result-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v5" strokeLinecap="round" />
        <circle cx="12" cy="16" r="0.6" fill="currentColor" />
      </svg>
      <h1 className="sec-h2">{content.heading}</h1>
      <p className="result-subheading">{content.subheading}</p>
      <div className="result-body">
        {content.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <div className="result-footer">
        <h4>{content.footerHeading}</h4>
        <p>{content.footerBody}</p>
      </div>
    </div>
  );
}
