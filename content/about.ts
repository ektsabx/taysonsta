import type { Locale } from "@/lib/i18n";

export interface AboutContent {
  intro: { heading: string; paragraphs: string[] };
  story: { heading: string; paragraphs: string[] };
  founder: { heading: string; name: string; title: string; paragraphs: string[] };
  vision: { heading: string; paragraphs: string[] };
  brand: { name: string; tagline: string };
}

const ar: AboutContent = {
  intro: {
    heading: "من نحن؟",
    paragraphs: [
      "**Taysonsta هي شركة متخصصة في بناء وتطوير الشركات والمنتجات الرقمية.**",
      "نعمل مع المؤسسين على تحويل الأفكار والفرص إلى منتجات رقمية حقيقية، ونساعد الشركات على تطوير منتجاتها وبناء الأنظمة التي تحتاجها للنمو.",
      "لا ننظر إلى التكنولوجيا كهدف بحد ذاته، بل كوسيلة لبناء منتجات وشركات لها قيمة حقيقية في السوق.",
    ],
  },
  story: {
    heading: "كيف بدأت Taysonsta؟",
    paragraphs: [
      "بدأت Taysonsta من تجربة عملية في العمل مع رواد الأعمال وبناء المنتجات الرقمية.",
      "من خلال هذه التجربة، لاحظنا أن الكثير من المؤسسين يمتلكون أفكارًا قوية وفرصًا حقيقية، لكن الانتقال من الفكرة إلى منتج فعلي يحتاج إلى أكثر من مجرد فكرة أو فريق تطوير.",
      "يحتاج إلى فهم المنتج، والسوق، وتجربة المستخدم، والتكنولوجيا، والقدرة على التنفيذ.",
      "ومن هنا تأسست Taysonsta لتكون شريكًا للمؤسسين في هذه الرحلة.",
    ],
  },
  founder: {
    heading: "المؤسس",
    name: "يوسف وليد",
    title: "Founder & CEO, Taysonsta",
    paragraphs: [
      "رائد أعمال يعمل في مجال الشركات والمنتجات الرقمية، وبدأ في بناء المشاريع الرقمية منذ سن مبكرة.",
      "أسس Taysonsta بهدف مساعدة المؤسسين على بناء منتجات حقيقية، والاستفادة من الخبرة المتراكمة في المنتج والتكنولوجيا والتنفيذ بدلًا من بناء كل شيء من الصفر بمفردهم.",
      "يؤمن يوسف أن أفضل الشركات تبدأ بفهم المشكلة جيدًا، ثم بناء المنتج الصحيح حولها، وليس بمجرد كتابة الكود.",
    ],
  },
  vision: {
    heading: "رؤيتنا",
    paragraphs: [
      "أن نبني شركة تساهم في إنشاء وتطوير **جيل جديد من الشركات الرقمية**، وأن تكون Taysonsta شريكًا طويل المدى للمؤسسين الذين يعملون على بناء شركات تستحق أن توجد.",
    ],
  },
  brand: {
    name: "Taysonsta",
    tagline: "Building digital companies with founders.",
  },
};

const en: AboutContent = {
  intro: {
    heading: "Who We Are",
    paragraphs: [
      "**Taysonsta is a company specialized in building and developing digital companies and products.**",
      "We work with founders to turn ideas and opportunities into real digital products, and we help companies develop their products and build the systems they need to grow.",
      "We don't see technology as an end in itself, but as a means to build products and companies with real value in the market.",
    ],
  },
  story: {
    heading: "How Taysonsta Started",
    paragraphs: [
      "Taysonsta started from hands-on experience working with entrepreneurs and building digital products.",
      "Through this experience, we noticed that many founders have strong ideas and real opportunities, but moving from an idea to an actual product takes more than just an idea or a development team.",
      "It takes an understanding of the product, the market, the user experience, the technology, and the ability to execute.",
      "That's how Taysonsta was founded — to be a partner for founders on this journey.",
    ],
  },
  founder: {
    heading: "The Founder",
    name: "Youssef Waleed",
    title: "Founder & CEO, Taysonsta",
    paragraphs: [
      "An entrepreneur working in digital companies and products, who started building digital projects from an early age.",
      "He founded Taysonsta to help founders build real products, and to benefit from accumulated experience in product, technology, and execution instead of building everything from scratch on their own.",
      "Youssef believes the best companies start with a deep understanding of the problem, then building the right product around it — not just writing code.",
    ],
  },
  vision: {
    heading: "Our Vision",
    paragraphs: [
      "To build a company that contributes to creating and developing a **new generation of digital businesses**, and for Taysonsta to be a long-term partner for founders building companies worth existing.",
    ],
  },
  brand: {
    name: "Taysonsta",
    tagline: "Building digital companies with founders.",
  },
};

const content: Record<Locale, AboutContent> = { ar, en };

export function getAboutContent(locale: Locale): AboutContent {
  return content[locale];
}
