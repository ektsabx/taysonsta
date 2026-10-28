import { founderNote } from "@/lib/content/social-proof";
import type { Locale } from "@/lib/i18n/config";

// The founder's note on the home page (lib/content/social-proof.ts). The
// hidden logo, customer-count and review sections were removed (owner, 2026-10-28).

const copy = {
  en: { founder: "A message from our founder" },
  ar: { founder: "رسالة من المؤسس" },
};

/** "A message from our founder": photo, name, job title and the note. */
export function FounderNote({ locale }: { locale: Locale }) {
  if (!founderNote) return null;
  const f = founderNote;
  return (
    <section className="section">
      <div className="site-width founder-note">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="founder-photo" src={f.photo} alt={f.name} width={120} height={120} loading="lazy" />
        <div>
          <p className="eyebrow">{copy[locale].founder}</p>
          <blockquote className="founder-message">{f.message[locale]}</blockquote>
          <p className="founder-sign"><strong>{f.name}</strong><span>{f.title[locale]}</span></p>
        </div>
      </div>
    </section>
  );
}
