// Questions with their answers, always visible (people and answer engines
// read the same text; the page's FAQPage data repeats exactly this).
export function Faq({ eyebrow, title, items }: { eyebrow?: string; title: string; items: { q: string; a: string }[] }) {
  if (!items.length) return null;
  return (
    <section className="section">
      {/* Centered on every page, like the pricing FAQ (owner, 2026-10-21). */}
      <div className="site-width faq-centered">
        <div className="section-head">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2 className="display-font">{title}</h2>
        </div>
        <dl className="faq-list">
          {items.map((f) => (
            <div className="faq-item" key={f.q}>
              <dt><h3>{f.q}</h3></dt>
              <dd>{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
