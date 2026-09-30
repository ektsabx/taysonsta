import type { HomeContent } from "@/content/home";
import type { Locale } from "@/lib/i18n";
import { getFaqs } from "@/services/faqs";
import { EmptyState } from "@/components/ui/EmptyState";
import { FAQAccordion } from "./FAQAccordion";

interface FAQSectionProps {
  content: HomeContent["faq"];
  locale: Locale;
}

export async function FAQSection({ content, locale }: FAQSectionProps) {
  const faqs = await getFaqs();

  return (
    <section className="ed-section" id="faq">
      <div className="ed-section-inner">
        <div className="ed-faq-head">
          <h2>{content.heading}</h2>
          <p>{content.subtitle}</p>
        </div>
        {faqs.length === 0 ? (
          <EmptyState
            title={locale === "ar" ? "لا توجد أسئلة بعد" : "No questions yet"}
            description={locale === "ar" ? "سنضيف الأسئلة الشائعة قريبًا." : "We'll add frequently asked questions soon."}
          />
        ) : (
          <div className="ed-faq-wrap">
            <FAQAccordion faqs={faqs} locale={locale} />
          </div>
        )}
      </div>
    </section>
  );
}
