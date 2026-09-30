import type { BookingContent } from "@/content/booking";

export function QualifiedResult({ content }: { content: BookingContent["qualified"] }) {
  return (
    <div className="result-page">
      <svg className="result-icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12.5l2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h1 className="sec-h2">{content.heading}</h1>
      <p className="result-subheading">{content.subheading}</p>
      <div className="result-body">
        {content.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <div className="result-before-call">
        <h3>{content.beforeCallTitle}</h3>
        <ul>
          {content.beforeCallItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <p className="result-closing">{content.closing}</p>
      <div className="result-footer">
        <h4>{content.footerHeading}</h4>
        <p>{content.footerBody}</p>
      </div>
    </div>
  );
}
