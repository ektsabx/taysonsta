import type { Locale } from "@/lib/i18n";

export interface SelectOption {
  value: string;
  label: string;
}

export interface BookingContent {
  meeting: {
    company: string;
    title: string;
    paragraphs: string[];
    duration: string;
    durationLabel: string;
    platform: string;
    platformLabel: string;
    timezone: string;
    timezoneLabel: string;
  };
  steps: {
    selectDuration: string;
    selectDate: string;
    selectTime: string;
    application: string;
    confirm: string;
    back: string;
    noSlots: string;
    loadingSlots: string;
    slotTaken: string;
    submitError: string;
  };
  calendar: {
    weekdayShort: string[];
  };
  form: {
    name: string;
    email: string;
    phone: string;
    gccResident: string;
    gccOptions: SelectOption[];
    need: string;
    needOptions: SelectOption[];
    projectType: string;
    projectTypeOptions: SelectOption[];
    ideaClarity: string;
    ideaClarityOptions: SelectOption[];
    validationStage: string;
    validationStageOptions: SelectOption[];
    revenueGoal: string;
    revenueOptions: SelectOption[];
    startTiming: string;
    startOptions: SelectOption[];
    decisionMaker: string;
    decisionOptions: SelectOption[];
    investment: string;
    /** Contains a "{price}" placeholder, substituted client-side with the package price. */
    investmentIntro: string;
    investmentOptions: SelectOption[];
    source: string;
    sourceOptions: SelectOption[];
    submit: string;
    submitting: string;
  };
  qualified: {
    heading: string;
    subheading: string;
    paragraphs: string[];
    beforeCallTitle: string;
    beforeCallItems: string[];
    closing: string;
    footerHeading: string;
    footerBody: string;
  };
  unqualified: {
    heading: string;
    subheading: string;
    paragraphs: string[];
    footerHeading: string;
    footerBody: string;
  };
}

const ar: BookingContent = {
  meeting: {
    company: "Taysonsta",
    title: "30 min meeting | Application Call",
    paragraphs: [
      "في هذه المكالمة الفردية مع فريق Taysonsta، سنتعرف على فكرتك، ونفهم ما تريد بناءه، ونحدد أفضل طريقة لتحويلها إلى منتج رقمي حقيقي وقابل للنمو.",
      "تعمل Taysonsta مع المؤسسين الذين لديهم فكرة واضحة أو فرصة حقيقية في السوق ويريدون تحويلها إلى SaaS أو Web App أو منتج رقمي، دون الحاجة إلى بناء فريق تقني كامل من الصفر.",
      "نحن لا نبني المنتجات لمجرد أن الفكرة تبدو جيدة. نساعدك على تحديد ما يستحق البناء، ووضع استراتيجية المنتج، ثم تحويل الفكرة إلى منتج حقيقي قابل للاستخدام والنمو.",
      "نعمل فقط مع المؤسسين الجادين في بناء Business حقيقي، وليس مجرد تجربة فكرة أو مشروع جانبي.",
    ],
    duration: "30 minutes",
    durationLabel: "المدة",
    platform: "Google Meet",
    platformLabel: "المكالمة",
    timezone: "Africa/Cairo",
    timezoneLabel: "التوقيت",
  },
  steps: {
    selectDuration: "اختر مدة المكالمة",
    selectDate: "اختر التاريخ",
    selectTime: "اختر الوقت",
    application: "استمارة الطلب",
    confirm: "تأكيد الحجز",
    back: "رجوع",
    noSlots: "لا توجد مواعيد متاحة حاليًا.",
    loadingSlots: "جارِ تحميل المواعيد المتاحة...",
    slotTaken: "للأسف تم حجز هذا الموعد للتو، اختر وقتًا آخر.",
    submitError: "حدث خطأ أثناء إرسال الطلب، حاول مرة أخرى.",
  },
  calendar: {
    weekdayShort: ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"],
  },
  form: {
    name: "الاسم بالكامل",
    email: "البريد الإلكتروني",
    phone: "رقم الهاتف",
    gccResident: "هل تقيم حاليًا في إحدى دول مجلس التعاون الخليجي (GCC)؟",
    gccOptions: [
      { value: "yes", label: "نعم" },
      { value: "no", label: "لا" },
    ],
    need: "أين أنت الآن؟",
    needOptions: [
      { value: "idea_to_startup", label: "لدي فكرة وأريد تحويلها إلى Startup / SaaS" },
      { value: "startup_build_product", label: "لدي Startup / SaaS وأريد بناء المنتج" },
      { value: "product_launch", label: "لدي منتج وأريد تطويره وإطلاقه" },
      { value: "existing_product_scale", label: "لدي منتج قائم وأريد تطويره والتوسع به" },
      { value: "expertise_to_product", label: "لدي خبرة أو Business وأريد تحويلها إلى Product" },
    ],
    projectType: "ما الذي تريد بناءه؟",
    projectTypeOptions: [
      { value: "saas", label: "SaaS" },
      { value: "web_app", label: "Web App" },
      { value: "mobile_app", label: "Mobile App" },
      { value: "marketplace", label: "Marketplace" },
      { value: "platform", label: "Platform" },
      { value: "not_decided", label: "لم أحدد بعد" },
    ],
    ideaClarity: "هل لديك فكرة واضحة للمشروع؟",
    ideaClarityOptions: [
      { value: "clear_idea", label: "نعم، لدي فكرة واضحة" },
      { value: "developing_idea", label: "لدي فكرة لكن ما زلت أطورها" },
      { value: "problem_only", label: "لدي مشكلة أريد بناء حل لها" },
      { value: "unknown", label: "لا أعرف ماذا أبني بعد" },
    ],
    validationStage: "أين وصل المشروع حاليًا؟",
    validationStageOptions: [
      { value: "just_idea", label: "مجرد فكرة" },
      { value: "researched_market", label: "بحثت عن السوق والفكرة" },
      { value: "prototype_design", label: "لدي Prototype / Design" },
      { value: "mvp", label: "لدي MVP" },
      { value: "has_customers", label: "لدي عملاء" },
      { value: "has_revenue", label: "لدي إيرادات بالفعل" },
    ],
    revenueGoal: "ما الهدف الذي تريد تحقيقه من المشروع؟",
    revenueOptions: [
      { value: "growable_startup", label: "بناء Startup قابلة للنمو" },
      { value: "first_customers", label: "الوصول لأول عملاء وإثبات الفكرة" },
      { value: "recurring_income", label: "بناء مصدر دخل متكرر" },
      { value: "10k_monthly", label: "الوصول إلى $10K+ شهريًا" },
      { value: "scalable_investable", label: "بناء شركة قابلة للتوسع والاستثمار" },
    ],
    startTiming: "متى تخطط لبدء العمل على المشروع؟",
    startOptions: [
      { value: "immediately", label: "فورًا" },
      { value: "within_30_days", label: "خلال 30 يومًا" },
      { value: "within_1_3_months", label: "خلال 1–3 أشهر" },
      { value: "exploring", label: "ما زلت أستكشف الخيارات" },
    ],
    decisionMaker: "هل أنت صاحب القرار في المشروع؟",
    decisionOptions: [
      { value: "yes", label: "نعم" },
      { value: "partner", label: "أتخذ القرار مع شريك" },
      { value: "no", label: "لا" },
    ],
    investment: "الاستثمار",
    investmentIntro:
      "تبدأ مشاريع Taysonsta من {price}، ويختلف الاستثمار النهائي حسب نطاق المشروع واحتياجاته. هل أنت مستعد للاستثمار في بناء مشروعك؟",
    investmentOptions: [
      { value: "ready", label: "نعم، مستعد للاستثمار" },
      { value: "need_details", label: "أحتاج معرفة التفاصيل أولًا" },
      { value: "no_capital", label: "لا أملك الميزانية حاليًا" },
    ],
    source: "كيف عرفت عن Taysonsta؟",
    sourceOptions: [
      { value: "youtube", label: "YouTube" },
      { value: "instagram", label: "Instagram" },
      { value: "tiktok", label: "TikTok" },
      { value: "ad", label: "إعلان" },
      { value: "referral", label: "ترشيح من رائد أعمال آخر" },
    ],
    submit: "تأكيد الحجز",
    submitting: "جارِ الإرسال...",
  },
  qualified: {
    heading: "تم تأكيد حجزك",
    subheading: "موعدك مع فريق Taysonsta أصبح مؤكدًا",
    paragraphs: [
      "استلمنا معلوماتك وتم تأكيد موعد المكالمة.",
      "بناءً على المعلومات التي شاركتها معنا، يبدو أن Taysonsta قد تكون مناسبة لمشروعك والمرحلة التي أنت فيها.",
      "في المكالمة سنتعرف بشكل أعمق على فكرتك، وما تريد بناءه، والفرصة التي تراها في السوق.",
      "سنحدد معًا:",
    ],
    beforeCallTitle: "قبل المكالمة، فكر في:",
    beforeCallItems: [
      "ماذا تريد أن تبني؟",
      "ما المشكلة التي تريد حلها؟",
      "من هو العميل الذي تستهدفه؟",
      "وأين تريد أن يصل المشروع؟",
    ],
    closing: "نراك في المكالمة.",
    footerHeading: "Taysonsta",
    footerBody: "نبني ونستثمر ونطوّر الجيل القادم من الشركات الرقمية.",
  },
  unqualified: {
    heading: "شكرًا لاهتمامك بـ Taysonsta",
    subheading: "لم يتم تأكيد حجز المكالمة",
    paragraphs: [
      "بعد مراجعة المعلومات التي شاركتها معنا، تبيّن أن مشروعك أو مرحلتك الحالية لا تتوافق مع الشروط التي نعمل وفقها في Taysonsta في الوقت الحالي.",
      "لذلك لم يتم تأكيد موعد المكالمة.",
      "نحن نعمل مع عدد محدود من المؤسسين والشركات، ونركز على المشاريع التي تكون جاهزة للاستثمار الجاد في بناء وتطوير منتج رقمي.",
      "هذا لا يعني أن فكرتك غير جيدة.",
      "قد يكون الأمر ببساطة أن المرحلة أو التوقيت الحالي غير مناسب بعد.",
      "يمكنك العودة عندما تتغير ظروف مشروعك وتصبح مستعدًا للخطوة التالية.",
      "في هذه الأثناء يمكنك التعرف أكثر على Taysonsta وما نبنيه.",
    ],
    footerHeading: "Taysonsta",
    footerBody: "نبني ونستثمر ونطوّر الجيل القادم من الشركات الرقمية.",
  },
};

const en: BookingContent = {
  meeting: {
    company: "Taysonsta",
    title: "30 min meeting | Application Call",
    paragraphs: [
      "In this one-on-one call with the Taysonsta team, we'll learn about your idea, understand what you want to build, and identify the best way to turn it into a real, scalable digital product.",
      "Taysonsta works with founders who have a clear idea or a real market opportunity and want to turn it into a SaaS, web app, or digital product, without needing to build a full technical team from scratch.",
      "We don't build products just because the idea sounds good. We help you determine what's worth building, set the product strategy, then turn the idea into a real, usable, and scalable product.",
      "We only work with founders who are serious about building a real business, not just testing an idea or a side project.",
    ],
    duration: "30 minutes",
    durationLabel: "Duration",
    platform: "Google Meet",
    platformLabel: "Meeting",
    timezone: "Africa/Cairo",
    timezoneLabel: "Timezone",
  },
  steps: {
    selectDuration: "Select Call Duration",
    selectDate: "Select a Date",
    selectTime: "Select a Time",
    application: "Application",
    confirm: "Confirm Booking",
    back: "Back",
    noSlots: "No available slots right now.",
    loadingSlots: "Loading available slots...",
    slotTaken: "That slot was just booked, please pick another time.",
    submitError: "Something went wrong submitting your application, please try again.",
  },
  calendar: {
    weekdayShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
  form: {
    name: "Your name",
    email: "Email address",
    phone: "Phone number",
    gccResident: "Do you currently reside in a GCC country?",
    gccOptions: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    need: "Where are you right now?",
    needOptions: [
      { value: "idea_to_startup", label: "I have an idea and want to turn it into a Startup / SaaS" },
      { value: "startup_build_product", label: "I have a Startup / SaaS and want to build the product" },
      { value: "product_launch", label: "I have a product and want to develop and launch it" },
      { value: "existing_product_scale", label: "I have an existing product and want to develop and scale it" },
      { value: "expertise_to_product", label: "I have expertise or a business I want to turn into a product" },
    ],
    projectType: "What do you want to build?",
    projectTypeOptions: [
      { value: "saas", label: "SaaS" },
      { value: "web_app", label: "Web App" },
      { value: "mobile_app", label: "Mobile App" },
      { value: "marketplace", label: "Marketplace" },
      { value: "platform", label: "Platform" },
      { value: "not_decided", label: "Not decided yet" },
    ],
    ideaClarity: "Do you have a clear idea for the project?",
    ideaClarityOptions: [
      { value: "clear_idea", label: "Yes, I have a clear idea" },
      { value: "developing_idea", label: "I have an idea but I'm still developing it" },
      { value: "problem_only", label: "I have a problem I want to build a solution for" },
      { value: "unknown", label: "I don't know what to build yet" },
    ],
    validationStage: "Where is the project right now?",
    validationStageOptions: [
      { value: "just_idea", label: "Just an idea" },
      { value: "researched_market", label: "Researched the market and the idea" },
      { value: "prototype_design", label: "I have a prototype / design" },
      { value: "mvp", label: "I have an MVP" },
      { value: "has_customers", label: "I have customers" },
      { value: "has_revenue", label: "I already have revenue" },
    ],
    revenueGoal: "What's the goal you want to achieve from the project?",
    revenueOptions: [
      { value: "growable_startup", label: "Build a growable startup" },
      { value: "first_customers", label: "Reach my first customers and validate the idea" },
      { value: "recurring_income", label: "Build a recurring source of income" },
      { value: "10k_monthly", label: "Reach $10K+ per month" },
      { value: "scalable_investable", label: "Build a scalable, investable company" },
    ],
    startTiming: "When are you planning to start working on the project?",
    startOptions: [
      { value: "immediately", label: "Immediately" },
      { value: "within_30_days", label: "Within 30 days" },
      { value: "within_1_3_months", label: "Within 1–3 months" },
      { value: "exploring", label: "Still exploring my options" },
    ],
    decisionMaker: "Are you the decision maker for the project?",
    decisionOptions: [
      { value: "yes", label: "Yes" },
      { value: "partner", label: "I decide with a partner" },
      { value: "no", label: "No" },
    ],
    investment: "Investment",
    investmentIntro:
      "Taysonsta projects start at {price}, and the final investment varies depending on the project's scope and needs. Are you ready to invest in building your project?",
    investmentOptions: [
      { value: "ready", label: "Yes, ready to invest" },
      { value: "need_details", label: "I need the details first" },
      { value: "no_capital", label: "I don't have the budget right now" },
    ],
    source: "How did you hear about Taysonsta?",
    sourceOptions: [
      { value: "youtube", label: "YouTube" },
      { value: "instagram", label: "Instagram" },
      { value: "tiktok", label: "TikTok" },
      { value: "ad", label: "An ad" },
      { value: "referral", label: "Referral from another founder" },
    ],
    submit: "Confirm Booking",
    submitting: "Submitting...",
  },
  qualified: {
    heading: "Your Booking Is Confirmed",
    subheading: "Your call with the Taysonsta team is now confirmed",
    paragraphs: [
      "We've received your information and confirmed your call.",
      "Based on the information you shared with us, Taysonsta looks like it could be a fit for your project and the stage you're at.",
      "On the call, we'll dig deeper into your idea, what you want to build, and the opportunity you see in the market.",
      "Together we'll define:",
    ],
    beforeCallTitle: "Before the call, think about:",
    beforeCallItems: [
      "What do you want to build?",
      "What problem are you trying to solve?",
      "Who's the customer you're targeting?",
      "Where do you want the project to reach?",
    ],
    closing: "See you on the call.",
    footerHeading: "Taysonsta",
    footerBody: "Building the next generation of digital businesses.",
  },
  unqualified: {
    heading: "Thanks for Your Interest in Taysonsta",
    subheading: "Your call was not confirmed",
    paragraphs: [
      "After reviewing the information you shared with us, your project or current stage doesn't align with the criteria we currently work with at Taysonsta.",
      "So your call was not confirmed.",
      "We work with a limited number of founders and companies, and focus on projects that are ready for serious investment in building and developing a digital product.",
      "This doesn't mean your idea isn't good.",
      "It may simply be that the stage or timing isn't right yet.",
      "You're welcome to come back once your project's circumstances change and you're ready for the next step.",
      "In the meantime, feel free to learn more about Taysonsta and what we're building.",
    ],
    footerHeading: "Taysonsta",
    footerBody: "Building the next generation of digital businesses.",
  },
};

const content: Record<Locale, BookingContent> = { ar, en };

export function getBookingContent(locale: Locale): BookingContent {
  return content[locale];
}
