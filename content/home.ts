import type { Locale } from "@/lib/i18n";

export interface HomeContent {
  hero: {
    headingBefore: string;
    headingHighlight: string;
    headingAfter: string;
    subheading: string;
    ctaLabel: string;
    secondaryCtaLabel: string;
    stats: { value: string; label: string }[];
  };
  whatWeBuild: {
    tag: string;
    heading: string;
    subtitle: string;
    items: { code: string; title: string; description: string }[];
  };
  founder: {
    tag: string;
    heading: string;
    paragraphs: string[];
    name: string;
    title: string;
  };
  portfolio: {
    tag: string;
    heading: string;
    subtitle: string;
    countLabel: string;
  };
  howWeHelp: {
    tag: string;
    heading: string;
    subtitle: string;
    items: { title: string; description: string }[];
  };
  qualification: {
    tag: string;
    heading: string;
    subtitle: string;
    rightFitTitle: string;
    rightFit: string[];
    wrongFitTitle: string;
    wrongFit: string[];
  };
  packages: {
    tag: string;
    heading: string;
    subtitle: string;
    ctaLabel: string;
    baselineLabel: string;
    baselineValue: string;
    footnote: string;
    plans: {
      name: string;
      description: string;
      price: string;
      priceLabel: string;
      deliverables: string[];
      timeline: string;
      support: string;
      highlighted?: boolean;
      badge?: string;
    }[];
  };
  whyUs: {
    tag: string;
    heading: string;
    subtitle: string;
    items: { code: string; title: string; description: string }[];
  };
  faq: {
    tag: string;
    heading: string;
    subtitle: string;
  };
  finalCta: {
    heading: string;
    body: string;
    cta: string;
  };
}

const ar: HomeContent = {
  hero: {
    headingBefore: "حوّل فكرتك إلى ",
    headingHighlight: "Startup",
    headingAfter: " أو SaaS أو منتج رقمي حقيقي.",
    subheading: "نبني معك المنتج من الفكرة والتحقق من السوق، إلى التصميم والتطوير والإطلاق.",
    ctaLabel: "احجز مكالمة",
    secondaryCtaLabel: "استكشف أعمالنا",
    stats: [
      { value: "12+", label: "منتجات تم بناؤها وإطلاقها" },
      { value: "5", label: "دول يعمل بها شركاؤنا" },
    ],
  },
  whatWeBuild: {
    tag: "01 / CAPABILITIES",
    heading: "ما الذي نبنيه معاً؟",
    subtitle: "More than development. We work with you to turn the idea into a product — not just write the code.",
    items: [
      { code: "CAT_01", title: "SaaS Products", description: "منتجات برمجية قائمة على الاشتراك الشهري والسنوي (B2B/B2C SaaS) بهوامش ربحية عالية." },
      { code: "CAT_02", title: "Digital Platforms", description: "منصات متكاملة، أسواق رقمية (Marketplaces)، وشبكات أعمال موجهة للشركات." },
      { code: "CAT_03", title: "Web & Mobile Apps", description: "تطبيقات ويب وجوال متقدمة موجهة مباشرة للمستهلك وتعتمد على أعلى معايير الـ UX." },
      { code: "CAT_04", title: "MVPs", description: "منتجات أساسية مبنية للتحقق من الفكرة بالسوق الحقيقي وإطلاقها والتعلّم السريع منها." },
      { code: "CAT_05", title: "AI-powered Products", description: "تطبيقات ونظم تدعم نماذج الذكاء الاصطناعي كحل وظيفي عملي يقدم قيمة فورية للعميل." },
      { code: "CAT_06", title: "Internal Business Platforms", description: "بوابات رقمية داخلية ولوحات تحكم لأتمتة عمليات المؤسسات والشركات القائمة." },
      { code: "CAT_07", title: "Customer-Facing Products", description: "بوابات اشتراكات، أنظمة حجز، وأدوات رقمية تفاعلية تمس العميل النهائي يومياً." },
      { code: "CAT_08", title: "Marketplaces & Ecosystems", description: "أسواق ثنائية الأطراف وبوابات وسائط صفقات مهيأة للنمو والاستحواذ." },
    ],
  },
  founder: {
    tag: "07 / FOUNDERSHIP",
    heading: "بُنيت على يد مؤسس، من أجل المؤسسين",
    paragraphs: [
      "بدأت رحلتي في بناء المشاريع الرقمية من سن مبكرة، وجربت أكتر من نموذج عمل قبل ما أوصل لقناعة إن أقوى المشاريع الرقمية هي اللي بتحل مشكلة حقيقية ويمكن تطويرها مع نمو المستخدمين.",
      "أسست Taysonsta لمساعدة المؤسسين على تحويل أفكارهم إلى منتجات رقمية حقيقية، بدل ما يجربوا لوحدهم ويضيعوا وقتهم وفلوسهم في تخمين.",
    ],
    name: "يوسف وليد",
    title: "مؤسس تايسونستا",
  },
  portfolio: {
    tag: "03 / PROVEN WORK",
    heading: "من الفكرة إلى منتج حقيقي",
    subtitle: "شركات بنيناها مع مؤسسين وحوّلنا أفكارهم إلى منتجات قابلة للإطلاق والنمو.",
    countLabel: "VERIFIED CASE STUDIES",
  },
  howWeHelp: {
    tag: "02 / SCOPE & PROCESS",
    heading: "ما الذي يتضمنه العمل معنا؟",
    subtitle: "نبني معك الأساس الذي تحتاجه لتحويل الفكرة إلى منتج وشركة قابلة للنمو المستمر.",
    items: [
      { title: "Product & Market Validation", description: "نتحقق من المشكلة والسوق ونحدد ما إذا كانت الفكرة تستحق البناء قبل الاستثمار في التطوير." },
      { title: "تطوير المنتج (Product Engineering)", description: "نحوّل الفكرة إلى MVP ومنتج فعلي قابل للاستخدام والتطوير مع كود برمجي نظيف." },
      { title: "بناء العرض (Building The Offer)", description: "نحدد الـ Positioning ونموذج العمل والقيمة التي يقدمها المنتج للعميل ليدفع ثمنها باقتناع." },
      { title: "UX/UI & Product Design", description: "نصمم تجربة المنتج وواجهاته بما يتناسب مع المستخدم والهدف التجاري للشركة." },
      { title: "Technology & Infrastructure", description: "نبني الـ Backend والـ Database والـ APIs والبنية السحابية الآمنة التي يحتاجها المنتج." },
      { title: "Go-to-Market Strategy", description: "نحدد استراتيجية إطلاق المنتج وقنوات الوصول إلى أول المستخدمين والمشترين الفعليين." },
      { title: "Launch & Optimization", description: "نختبر المنتج ونراجع التجربة والأنظمة قبل الإطلاق، ثم نستخدم البيانات لتحسينه بعد الإطلاق." },
    ],
  },
  qualification: {
    tag: "04 / QUALIFICATION",
    heading: "Who we work with — Is Taysonsta right for you?",
    subtitle: "نعمل بأسلوب الشراكة النخبوية المركزة، ولذلك نضع معايير واضحة لمن يناسبنا ومن لا نناسبه.",
    rightFitTitle: "Taysonsta مناسب لك لو:",
    rightFit: [
      "عندك SaaS أو digital product واضح عايز تبنيه وتطلقه للسوق.",
      "عايز فريق متكامل يتولى المنتج من مرحلة الاستراتيجية والتصميم وحتى التطوير النهائي.",
      "مستعد تستثمر في بناء منتج حقيقي يمثل شركة مستقرة وليس تجربة عابرة.",
      "عندك ميزانية استثمارية للمشروع تبدأ من $25,000.",
    ],
    wrongFitTitle: "مش مناسب لك لو:",
    wrongFit: [
      "بتدور على developer بالساعة أو فريلانسر ينفذ مهام برمجية صغيرة.",
      "محتاج website بسيط أو صفحة هبوط ترويجية فقط دون منتج ونظام تشغيل.",
      "ميزانيتك الإجمالية المخصصة لبناء وتأسيس المنتج أقل من $25K.",
      "تبحث عن جهة تنفذ ما تمليه حرفياً دون نقاش جدوى المنتج وسلوكه مع العميل.",
    ],
  },
  packages: {
    tag: "06 / ENGAGEMENT PACKAGES",
    heading: "باقاتنا",
    subtitle: "باقتان واضحتان حسب مرحلة مشروعك وأهدافه في السوق.",
    ctaLabel: "ابدأ مشروعك",
    baselineLabel: "Baseline Investment",
    baselineValue: "PROJECTS START AT $25,000",
    footnote: "Every project is different. Final pricing depends on the product, scope and complexity.",
    plans: [
      {
        name: "MVP",
        description: "لمؤسسين يحوّلون فكرة إلى منتج حقيقي جاهز للإطلاق.",
        price: "$5,000",
        priceLabel: "تبدأ من",
        deliverables: [
          "استراتيجية المنتج وتحديد نطاق العمل",
          "التحقق من السوق ونموذج العمل",
          "تصميم UX/UI كامل للشاشات الأساسية",
          "تطوير المنتج الأساسي والـ Backend",
          "المصادقة وأدوار المستخدمين (Auth & Roles)",
          "لوحة تحكم إدارية (Admin Dashboard)",
          "ربط بوابات الدفع الإلكتروني",
          "النشر والإطلاق السحابي",
          "تسليم خلال 6–10 أسابيع عمل",
          "دعم فني وضمان لمدة شهر كامل",
        ],
        timeline: "6–10 أسابيع",
        support: "دعم لمدة شهر",
      },
      {
        name: "Growth",
        description: "لشركات ناشئة جاهزة لبناء منتج متكامل وقابل للتوسع العالي.",
        price: "$20,000",
        priceLabel: "تبدأ من",
        deliverables: [
          "استراتيجية المنتج وبحوث السوق المعمقة",
          "UX/UI كامل مع Design System مخصص",
          "مزايا أساسية متعددة وهندسة ميكرو-سيرفس",
          "منظومة ويب + تطبيقات موبايل (Web & Mobile)",
          "بنية SaaS مهيأة لملايين المعاملات",
          "أنظمة المدفوعات والاشتراكات الدورية المتقدمة",
          "لوحة تحكم إدارية متقدمة (Advanced Operations OS)",
          "APIs وربط الأنظمة الخارجية وتكاملات مخصصة",
          "أنظمة التحليلات وتتبع سلوك المستخدمين",
          "تسليم خلال 10–16 أسبوعاً مع إعداد الإنتاج",
          "دعم فني وهندسي مستمر لمدة 3 أشهر",
        ],
        timeline: "10–16 أسبوعًا",
        support: "دعم لمدة 3 أشهر",
        highlighted: true,
        badge: "الأكثر طلباً",
      },
    ],
  },
  whyUs: {
    tag: "05 / DIFFERENTIATION",
    heading: "ليه تختار Taysonsta؟",
    subtitle: "مش محتاج 15 سبباً دعائياً. نحن نركز على 3 ركائز حقيقية فقط:",
    items: [
      {
        code: "PILLAR // 01",
        title: "One team. One product.",
        description:
          "بدل ما تتعامل مع Strategy Agency وDesigner وSoftware House وFreelancer منفصلين، تتعامل مع فريق واحد يجمع الاستراتيجية والتصميم والهندسة البرمجية من البداية للنهاية.",
      },
      {
        code: "PILLAR // 02",
        title: "Built for founders.",
        description:
          "إحنا مش بنبني Features لمجرد إنك طلبتها. نفهم ما يلزم لتحويل الفكرة لشركة حقيقية، ونبدأ دائماً من المعادلة: المشكلة ← العميل ← نموذج العمل ← المنتج.",
      },
      {
        code: "PILLAR // 03",
        title: "Built for launch & Ownership.",
        description:
          "نركز على بناء منتجات جاهزة للاستخدام الحقيقي والاختبار بالسوق. المنتج والكود والملكية الفكرية (IP) ملك كامل لك بدون أي قيود تعاقدية.",
      },
    ],
  },
  faq: {
    tag: "08 / INQUIRIES",
    heading: "عندك سؤال قبل ما تحجز؟",
    subtitle: "إجابات واضحة ومباشرة حول آلية العمل، الاستثمار، والتنفيذ.",
  },
  finalCta: {
    heading: "جاهز تبني الـ Startup بتاعك؟",
    body: "إذا كانت لديك فكرة Startup أو SaaS أو منتج رقمي وتريد تحويلها إلى منتج حقيقي، ابدأ بمكالمة معنا لمناقشة نطاق العمل.",
    cta: "احجز مكالمة",
  },
};

const en: HomeContent = {
  hero: {
    headingBefore: "Turn your idea into a real ",
    headingHighlight: "Startup",
    headingAfter: ", SaaS, or digital product.",
    subheading: "We build the product with you — from the idea and market validation, to design, development, and launch.",
    ctaLabel: "Book a Call",
    secondaryCtaLabel: "Explore Our Work",
    stats: [
      { value: "12+", label: "Products built and launched" },
      { value: "5", label: "Countries our partners work in" },
    ],
  },
  whatWeBuild: {
    tag: "01 / CAPABILITIES",
    heading: "What We Build",
    subtitle: "More than development. We work with you to turn the idea into a product — not just write the code.",
    items: [
      { code: "CAT_01", title: "SaaS Products", description: "Subscription-based software businesses (B2B/B2C SaaS) with high-margin economics." },
      { code: "CAT_02", title: "Digital Platforms", description: "Integrated platforms, marketplaces, and business networks built for companies." },
      { code: "CAT_03", title: "Web & Mobile Apps", description: "Advanced consumer-facing apps built to the highest UX standards." },
      { code: "CAT_04", title: "MVPs", description: "Lean products built to validate the idea in the real market, launch, and learn fast." },
      { code: "CAT_05", title: "AI-powered Products", description: "Apps and systems that use AI models as a practical, functional solution delivering immediate value." },
      { code: "CAT_06", title: "Internal Business Platforms", description: "Internal portals and dashboards that automate operations for established organizations." },
      { code: "CAT_07", title: "Customer-Facing Products", description: "Subscription portals, booking systems, and interactive tools used by end customers daily." },
      { code: "CAT_08", title: "Marketplaces & Ecosystems", description: "Two-sided marketplaces and deal-flow platforms built for growth and acquisition." },
    ],
  },
  founder: {
    tag: "07 / FOUNDERSHIP",
    heading: "Built by a Founder, for Founders",
    paragraphs: [
      "I started my journey in building digital businesses from an early age, and tried more than one business model before I became convinced that the strongest digital products are the ones that solve a real problem and can be developed as their user base grows.",
      "I founded Taysonsta to help founders turn their ideas into real digital products, instead of trying it alone and wasting their time and money guessing.",
    ],
    name: "Youssef Waleed",
    title: "Founder of Taysonsta",
  },
  portfolio: {
    tag: "03 / PROVEN WORK",
    heading: "From Idea to Real Product",
    subtitle: "Companies we've built with founders, turning their ideas into products ready to launch and grow.",
    countLabel: "VERIFIED CASE STUDIES",
  },
  howWeHelp: {
    tag: "02 / SCOPE & PROCESS",
    heading: "What Does Working With Us Include?",
    subtitle: "We build the foundation you need to turn your idea into a product and a company ready to grow continuously.",
    items: [
      { title: "Product & Market Validation", description: "We validate the problem and the market, and determine whether the idea is worth building before investing in development." },
      { title: "Product Engineering", description: "We turn the idea into an MVP and a real, usable product, built with clean, maintainable code." },
      { title: "Building The Offer", description: "We define the positioning, business model, and the value the product delivers so customers pay for it with conviction." },
      { title: "UX/UI & Product Design", description: "We design the product experience and interfaces to fit the user and the business goal." },
      { title: "Technology & Infrastructure", description: "We build the backend, database, APIs, and the secure cloud infrastructure the product needs." },
      { title: "Go-to-Market Strategy", description: "We define the launch strategy and the channels to reach the first real users and buyers." },
      { title: "Launch & Optimization", description: "We test the product and review the experience and systems before launch, then use data to improve it afterward." },
    ],
  },
  qualification: {
    tag: "04 / QUALIFICATION",
    heading: "Who we work with — Is Taysonsta right for you?",
    subtitle: "We work in a focused, high-touch partnership model, so we set clear criteria for who is — and isn't — the right fit.",
    rightFitTitle: "Taysonsta is right for you if:",
    rightFit: [
      "You have a clear SaaS or digital product idea you want to build and launch to market.",
      "You want a full team to own the product from strategy and design through to final development.",
      "You're ready to invest in building a real product that represents a stable company, not a passing experiment.",
      "Your investment budget for the project starts from $25,000.",
    ],
    wrongFitTitle: "It's not the right fit if:",
    wrongFit: [
      "You're looking for an hourly developer or freelancer to execute small coding tasks.",
      "You need a simple website or a promotional landing page only, with no product or operating system.",
      "Your total budget for building and establishing the product is under $25K.",
      "You're looking for someone to execute exactly what you dictate, with no discussion of product viability or customer behavior.",
    ],
  },
  packages: {
    tag: "06 / ENGAGEMENT PACKAGES",
    heading: "Our Packages",
    subtitle: "Two clear packages depending on your project's stage and market goals.",
    ctaLabel: "Start Your Project",
    baselineLabel: "Baseline Investment",
    baselineValue: "PROJECTS START AT $25,000",
    footnote: "Every project is different. Final pricing depends on the product, scope and complexity.",
    plans: [
      {
        name: "MVP",
        description: "For founders turning an idea into a real, launch-ready product.",
        price: "$5,000",
        priceLabel: "Starting from",
        deliverables: [
          "Product strategy and scope definition",
          "Market validation and business model",
          "Full UX/UI design for core screens",
          "Core product development and backend",
          "Authentication & user roles (Auth & Roles)",
          "Admin dashboard",
          "Payment gateway integration",
          "Cloud deployment and launch",
          "6–10 week delivery",
          "One month of support and warranty",
        ],
        timeline: "6–10 weeks",
        support: "1-month support",
      },
      {
        name: "Growth",
        description: "For startups ready to build a complete, highly scalable product.",
        price: "$20,000",
        priceLabel: "Starting from",
        deliverables: [
          "Product strategy and deep market research",
          "Full UX/UI with a custom design system",
          "Multiple core features and microservice architecture",
          "Web + mobile apps",
          "SaaS architecture built for millions of transactions",
          "Advanced payment and recurring subscription systems",
          "Advanced admin dashboard (Advanced Operations OS)",
          "APIs, external integrations, and custom connections",
          "Analytics and user behavior tracking",
          "10–16 week delivery with production setup",
          "3 months of continuous engineering support",
        ],
        timeline: "10–16 weeks",
        support: "3-month support",
        highlighted: true,
        badge: "Most Popular",
      },
    ],
  },
  whyUs: {
    tag: "05 / DIFFERENTIATION",
    heading: "Why Choose Taysonsta",
    subtitle: "You don't need 15 marketing reasons. We focus on 3 real pillars only:",
    items: [
      {
        code: "PILLAR // 01",
        title: "One team. One product.",
        description:
          "Instead of a separate strategy agency, designer, software house, and freelancer, you work with one team that owns strategy, design, and engineering from start to finish.",
      },
      {
        code: "PILLAR // 02",
        title: "Built for founders.",
        description:
          "We don't build features just because you asked for them. We understand what it takes to turn the idea into a real company, always starting from: Problem ← Customer ← Business Model ← Product.",
      },
      {
        code: "PILLAR // 03",
        title: "Built for launch & Ownership.",
        description:
          "We focus on building products ready for real use and market testing. The product, the code, and the IP are fully yours, with no contractual strings attached.",
      },
    ],
  },
  faq: {
    tag: "08 / INQUIRIES",
    heading: "Have a question before you book?",
    subtitle: "Clear, direct answers about how we work, the investment, and delivery.",
  },
  finalCta: {
    heading: "Ready to Build Your Startup?",
    body: "If you have a Startup, SaaS, or digital product idea and want to turn it into a real product, start with a call with us to discuss scope.",
    cta: "Book a Call",
  },
};

const content: Record<Locale, HomeContent> = { ar, en };

export function getHomeContent(locale: Locale): HomeContent {
  return content[locale];
}
