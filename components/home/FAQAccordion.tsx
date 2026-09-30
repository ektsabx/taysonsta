"use client";

import { useState } from "react";
import type { Faq } from "@/services/faqs";
import type { Locale } from "@/lib/i18n";

interface FAQAccordionProps {
  faqs: Faq[];
  locale: Locale;
}

export function FAQAccordion({ faqs, locale }: FAQAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="faq-wrap">
      <div className="faq-list">
        {faqs.map((faq) => {
          const isOpen = openId === faq.id;
          return (
            <div className={`faq-item${isOpen ? " open" : ""}`} key={faq.id}>
              <button
                type="button"
                className="faq-q"
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                aria-expanded={isOpen}
              >
                <span>{locale === "ar" ? faq.question_ar : faq.question_en}</span>
                <span className="faq-plus">+</span>
              </button>
              <div className="faq-a">{locale === "ar" ? faq.answer_ar : faq.answer_en}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
