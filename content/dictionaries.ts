import type { Locale } from "@/lib/i18n";
import type { PortfolioRelationshipType } from "@/types/database";

export interface Dictionary {
  nav: {
    home: string;
    about: string;
    services: string;
    portfolio: string;
    caseStudies: string;
    careers: string;
    blog: string;
    bookCall: string;
    language: string;
    menu: string;
  };
  footer: {
    quickLinks: string;
    stayInLoop: string;
    newsletterDesc: string;
    emailPlaceholder: string;
    subscribe: string;
    subscribing: string;
    subscribeSuccess: string;
    subscribeError: string;
    rights: string;
  };
  common: {
    loading: string;
    errorTitle: string;
    errorDesc: string;
    retry: string;
    emptyBlogTitle: string;
    emptyBlogDesc: string;
    notFoundTitle: string;
    notFoundDesc: string;
    backHome: string;
  };
  blog: {
    title: string;
    subtitle: string;
    readingTime: (minutes: number) => string;
    backToBlog: string;
  };
  portfolio: {
    title: string;
    subtitle: string;
    filterAll: string;
    relationshipLabel: Record<PortfolioRelationshipType, string>;
    statsCompanies: string;
    statsMarkets: string;
    statsExits: string;
    emptyTitle: string;
    emptyDesc: string;
    sectionAbout: string;
    sectionWhatWeBuilt: string;
    sectionRole: string;
    sectionTimeline: string;
    founded: string;
    industry: string;
    markets: string;
    status: string;
    statusActive: string;
    statusInactive: string;
    backToPortfolio: string;
    projectDetails: string;
    visitLive: string;
    relationship: string;
    usersLabel: string;
  };
  caseStudies: {
    title: string;
    subtitle: string;
    emptyTitle: string;
    emptyDesc: string;
    client: string;
    industry: string;
    backToCaseStudies: string;
    projectDetails: string;
    category: string;
    countryLabel: string;
    roleLabel: string;
    usersLabel: string;
    sectionOverview: string;
    sectionChallenge: string;
    sectionProductStrategy: string;
    sectionDesignDev: string;
    sectionKeyFeatures: string;
    sectionLaunch: string;
    visitLive: string;
    sectionResults: string;
    sectionTestimonial: string;
  };
  careers: {
    title: string;
    emptyTitle: string;
    viewJob: string;
    postedOn: string;
    teamLabel: string;
    locationLabel: string;
    employmentTypeLabel: string;
    backToCareers: string;
    sectionSummary: string;
    sectionRole: string;
    sectionIdeal: string;
    sectionRequirements: string;
    sectionResponsibilities: string;
    sectionDisqualifiers: string;
    applyHeading: string;
    applySuccessTitle: string;
    applySuccessDesc: string;
    alreadyAppliedTitle: string;
    alreadyAppliedDesc: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    instagram: string;
    otherSocials: string;
    country: string;
    age: string;
    educationStatus: string;
    coursesCompleted: string;
    yearsExperience: string;
    bio: string;
    whyFit: string;
    expectedSalary: string;
    portfolioFile: string;
    submit: string;
    submitting: string;
    submitError: string;
  };
}

const ar: Dictionary = {
  nav: {
    home: "الرئيسية",
    about: "من نحن",
    services: "حلولنا",
    portfolio: "أعمالنا",
    caseStudies: "عملائنا",
    careers: "الوظائف",
    blog: "المدونة",
    bookCall: "احجز مكالمة",
    language: "اللغة",
    menu: "القائمة",
  },
  footer: {
    quickLinks: "حلولنا",
    stayInLoop: "ابقَ على اطلاع",
    newsletterDesc: "أفكار وخطوات عملية بين الحين والآخر لتحويل فكرتك إلى مشروع منتجات رقمية.",
    emailPlaceholder: "بريدك الإلكتروني",
    subscribe: "اشترك",
    subscribing: "جارِ الاشتراك...",
    subscribeSuccess: "تم الاشتراك بنجاح.",
    subscribeError: "حدث خطأ، حاول مرة أخرى.",
    rights: "© 2026 Taysonsta. All rights reserved.",
  },
  common: {
    loading: "جارِ التحميل...",
    errorTitle: "حدث خطأ ما",
    errorDesc: "لم نتمكن من تحميل هذا المحتوى الآن. حاول مرة أخرى.",
    retry: "إعادة المحاولة",
    emptyBlogTitle: "لا توجد مقالات بعد",
    emptyBlogDesc: "نعمل على إعداد محتوى جديد، تابعنا قريبًا.",
    notFoundTitle: "الصفحة اللي بتدور عليها مش موجودة",
    notFoundDesc: "ممكن يكون الرابط اتغيّر أو الصفحة اتشالت.",
    backHome: "العودة للصفحة الرئيسية",
  },
  blog: {
    title: "المدونة",
    subtitle: "أفكار وخطوات عملية لبناء مشروع منتجات رقمية",
    readingTime: (minutes) => `${minutes} دقائق قراءة`,
    backToBlog: "العودة للمدونة",
  },
  portfolio: {
    title: "أعمال تايسونستا",
    subtitle: "الشركات والمنتجات التي لتايسونستا فيها علاقة ملكية، شراكة، استثمار أو استحواذ.",
    filterAll: "الكل",
    relationshipLabel: {
      owned: "ملكية كاملة",
      co_founded: "تأسيس مشترك",
      equity: "حصة ملكية",
      revenue_share: "مشاركة إيرادات",
      acquired: "استحواذ",
    },
    statsCompanies: "شركة",
    statsMarkets: "سوق",
    statsExits: "استحواذ",
    emptyTitle: "لا توجد شركات بعد",
    emptyDesc: "نعمل على إضافة أعمالنا هنا قريبًا.",
    sectionAbout: "عن الشركة",
    sectionWhatWeBuilt: "ماذا بنينا",
    sectionRole: "دور تايسونستا",
    sectionTimeline: "المحطات",
    founded: "تأسست",
    industry: "المجال",
    markets: "الأسواق",
    status: "الحالة",
    statusActive: "نشطة",
    statusInactive: "غير نشطة",
    backToPortfolio: "العودة لأعمالنا",
    projectDetails: "تفاصيل الشركة",
    visitLive: "زيارة الموقع",
    relationship: "نوع العلاقة",
    usersLabel: "عدد المستخدمين",
  },
  caseStudies: {
    title: "منتجات تم بنائها من الفكرة إلى الإطلاق",
    subtitle: "مجموعة مختارة من المنتجات الرقمية التي صممناها وطوّرناها لعملائنا.",
    emptyTitle: "لا توجد قصص عملاء بعد",
    emptyDesc: "نعمل على إضافة قصص نجاح عملائنا هنا قريبًا.",
    client: "العميل",
    industry: "المجال",
    backToCaseStudies: "العودة لدراسات الحالة",
    projectDetails: "تفاصيل المشروع",
    category: "التصنيف",
    countryLabel: "الدولة",
    roleLabel: "دور Taysonsta",
    usersLabel: "عدد المستخدمين",
    sectionOverview: "نظرة عامة",
    sectionChallenge: "التحدي",
    sectionProductStrategy: "استراتيجية المنتج",
    sectionDesignDev: "التصميم والتطوير",
    sectionKeyFeatures: "أبرز المزايا",
    sectionLaunch: "الإطلاق",
    visitLive: "زيارة الموقع",
    sectionResults: "النتائج",
    sectionTestimonial: "شهادة المؤسس",
  },
  careers: {
    title: "انضم لفريق تايسونستا",
    emptyTitle: "لا توجد وظائف متاحة حاليًا",
    viewJob: "التفاصيل والتقديم",
    postedOn: "تاريخ النشر",
    teamLabel: "الفريق",
    locationLabel: "الموقع",
    employmentTypeLabel: "نوع العمل",
    backToCareers: "العودة للوظائف",
    sectionSummary: "ملخص الوظيفة",
    sectionRole: "دورك",
    sectionIdeal: "المرشح المثالي",
    sectionRequirements: "المتطلبات",
    sectionResponsibilities: "ما الذي ستقوم به",
    sectionDisqualifiers: "لا تتقدم لهذه الوظيفة إذا",
    applyHeading: "تعتقد أنك مناسب؟ قدم الآن",
    applySuccessTitle: "تم استلام طلبك",
    applySuccessDesc: "شكرًا لتقديمك، هنراجع طلبك ونتواصل معك لو كان هناك تطابق.",
    alreadyAppliedTitle: "تم التقديم بالفعل",
    alreadyAppliedDesc: "قدّمت على هذه الوظيفة من قبل، سنتواصل معك لو كان هناك تطابق.",
    firstName: "الاسم الأول",
    lastName: "اسم العائلة",
    phone: "رقم الهاتف",
    email: "البريد الإلكتروني",
    instagram: "حساب انستجرام",
    otherSocials: "روابط أخرى (اختياري)",
    country: "الدولة",
    age: "العمر",
    educationStatus: "الحالة التعليمية",
    coursesCompleted: "كورسات أتممتها (اختياري)",
    yearsExperience: "سنوات الخبرة",
    bio: "نبذة عنك",
    whyFit: "ليه انت مناسب للوظيفة دي؟",
    expectedSalary: "الراتب المتوقع",
    portfolioFile: "ملف أعمالك (اختياري)",
    submit: "إرسال الطلب",
    submitting: "جارِ الإرسال...",
    submitError: "حدث خطأ أثناء الإرسال، حاول مرة أخرى.",
  },
};

const en: Dictionary = {
  nav: {
    home: "Home",
    about: "About Us",
    services: "Solutions",
    portfolio: "Portfolio",
    caseStudies: "Clients",
    careers: "Careers",
    blog: "Blog",
    bookCall: "Book a Call",
    language: "Language",
    menu: "Menu",
  },
  footer: {
    quickLinks: "Solutions",
    stayInLoop: "Stay in the loop",
    newsletterDesc: "Occasional ideas and practical steps for turning your idea into a digital products business.",
    emailPlaceholder: "Your email",
    subscribe: "Subscribe",
    subscribing: "Subscribing...",
    subscribeSuccess: "You're subscribed.",
    subscribeError: "Something went wrong, please try again.",
    rights: "© 2026 Taysonsta. All rights reserved.",
  },
  common: {
    loading: "Loading...",
    errorTitle: "Something went wrong",
    errorDesc: "We couldn't load this content right now. Please try again.",
    retry: "Retry",
    emptyBlogTitle: "No articles yet",
    emptyBlogDesc: "We're working on new content, check back soon.",
    notFoundTitle: "The page you're looking for isn't here",
    notFoundDesc: "The link may have changed, or the page may have been removed.",
    backHome: "Back to Home",
  },
  blog: {
    title: "Blog",
    subtitle: "Ideas and practical steps for building a digital products business",
    readingTime: (minutes) => `${minutes} min read`,
    backToBlog: "Back to Blog",
  },
  portfolio: {
    title: "Taysonsta Portfolio",
    subtitle: "The companies and products Taysonsta owns, co-founded, holds equity in, shares revenue with, or has acquired.",
    filterAll: "All",
    relationshipLabel: {
      owned: "Owned",
      co_founded: "Co-Founded",
      equity: "Equity",
      revenue_share: "Revenue Share",
      acquired: "Acquired",
    },
    statsCompanies: "Companies",
    statsMarkets: "Markets",
    statsExits: "Exits",
    emptyTitle: "No companies yet",
    emptyDesc: "We're adding our portfolio here soon.",
    sectionAbout: "About",
    sectionWhatWeBuilt: "What We Built",
    sectionRole: "Taysonsta's Role",
    sectionTimeline: "Timeline",
    founded: "Founded",
    industry: "Industry",
    markets: "Markets",
    status: "Status",
    statusActive: "Active",
    statusInactive: "Inactive",
    backToPortfolio: "Back to Portfolio",
    projectDetails: "Company Details",
    visitLive: "Visit Website",
    relationship: "Relationship",
    usersLabel: "Users",
  },
  caseStudies: {
    title: "Products Built From Idea to Launch",
    subtitle: "A curated selection of the digital products we've designed and developed for our clients.",
    emptyTitle: "No client stories yet",
    emptyDesc: "We're adding client success stories here soon.",
    client: "Client",
    industry: "Industry",
    backToCaseStudies: "Back to Case Studies",
    projectDetails: "Project Details",
    category: "Category",
    countryLabel: "Country",
    roleLabel: "Taysonsta Role",
    usersLabel: "Users",
    sectionOverview: "Overview",
    sectionChallenge: "The Challenge",
    sectionProductStrategy: "Product Strategy",
    sectionDesignDev: "Design & Development",
    sectionKeyFeatures: "Key Features",
    sectionLaunch: "Launch",
    visitLive: "Visit Live Site",
    sectionResults: "Results",
    sectionTestimonial: "Founder Testimonial",
  },
  careers: {
    title: "Join the Taysonsta Team",
    emptyTitle: "No open positions right now",
    viewJob: "Details & Apply",
    postedOn: "Posted",
    teamLabel: "Team",
    locationLabel: "Location",
    employmentTypeLabel: "Employment Type",
    backToCareers: "Back to Careers",
    sectionSummary: "Job Summary",
    sectionRole: "Your Role",
    sectionIdeal: "Ideal Candidate",
    sectionRequirements: "Requirements",
    sectionResponsibilities: "What You'll Do",
    sectionDisqualifiers: "Don't Apply If",
    applyHeading: "Think you're a fit? Apply now",
    applySuccessTitle: "Application received",
    applySuccessDesc: "Thanks for applying. We'll review your application and reach out if there's a match.",
    alreadyAppliedTitle: "Already applied",
    alreadyAppliedDesc: "You've already applied to this role. We'll reach out if there's a match.",
    firstName: "First Name",
    lastName: "Last Name",
    phone: "Phone Number",
    email: "Email",
    instagram: "Instagram Handle",
    otherSocials: "Other Links (optional)",
    country: "Country",
    age: "Age",
    educationStatus: "Education Status",
    coursesCompleted: "Courses Completed (optional)",
    yearsExperience: "Years of Experience",
    bio: "About You",
    whyFit: "Why are you a fit for this role?",
    expectedSalary: "Expected Salary",
    portfolioFile: "Portfolio File (optional)",
    submit: "Submit Application",
    submitting: "Submitting...",
    submitError: "Something went wrong, please try again.",
  },
};

const dictionaries: Record<Locale, Dictionary> = { ar, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
