import type { Localized } from "./types";

// /community (owner brief 2026-10-19): laid out like lovable.dev/community —
// hero, overview, three ways to take part, events, partnership, FAQ, final
// call to action. The community itself is the Yolias Facebook group
// (COMMUNITY_URL). No member counts are shown until real numbers exist.

export interface CommunityCopy {
  seoTitle: string; metaDescription: string;
  eyebrow: string; title: string; lead: string; join: string; secondary: string;
  overview: string;
  ways: { title: string; body: string; link: string; href: string; external?: boolean }[];
  events: { title: string; body: string; cta: string };
  partner: { title: string; body: string; cta: string };
  faqTitle: string; faq: { q: string; a: string }[];
  final: { title: string; body: string; primary: string; secondary: string };
}

export const communityPage: Localized<CommunityCopy> = {
  en: {
    seoTitle: "Yolias Community | Founders and sales teams growing with AI",
    metaDescription: "Join the Yolias community on Facebook: founders, marketers and sales teams sharing how they find customers, write outreach and grow with AI.",
    eyebrow: "COMMUNITY",
    title: "Welcome to the Yolias community",
    lead: "Grow alongside founders, marketers and sales teams who use AI to find and win customers. Whether you’re just starting or running a full sales team, there’s a place for you here.",
    join: "Join the community on Facebook",
    secondary: "Become a partner",
    overview: "Ask questions and get answers from people doing the same work, share what’s working in your outreach, see new Yolias features first and tell us what to build next — in English and Arabic.",
    ways: [
      { title: "Join online", body: "The Yolias Facebook group is where members share wins, ask for feedback on their outreach and get help from the team and each other.", link: "Join the Facebook group", href: "community", external: true },
      { title: "Learn and get help", body: "Guides, documentation and answers to common questions about finding customers, outreach and the Yolias AI agent.", link: "Open the Help Center", href: "/help-center" },
      { title: "Become a partner", body: "Creators, agencies and community leaders who recommend Yolias earn a commission on every paying customer they refer.", link: "Explore the partner program", href: "/affiliates" },
    ],
    events: {
      title: "Run a Yolias session for your community",
      body: "Host a workshop, a live demo or a sales meetup for your founders’ group, accelerator or students, online or in person. Tell us about it and the Yolias team will help with content and a walkthrough of the product.",
      cta: "Tell us about your event",
    },
    partner: {
      title: "Partner with Yolias",
      body: "Agencies, educators, incubators and content creators can bring Yolias to the businesses they work with, and earn on the customers they refer.",
      cta: "Explore partnerships",
    },
    faqTitle: "Frequently asked questions",
    faq: [
      { q: "Who can join the Yolias community?", a: "Anyone interested in finding customers and growing a business with AI: founders, freelancers, marketers, sales teams and agencies. You don’t need a Yolias plan to join." },
      { q: "Where does the community meet?", a: "In the Yolias Facebook group. Ask to join and a moderator approves you." },
      { q: "Does it cost anything?", a: "No. The community is free." },
      { q: "Which languages are used?", a: "English and Arabic. Write in the one you’re most comfortable with." },
      { q: "Do I need experience in sales or AI?", a: "No. Many members are just starting out. Ask anything — beginners’ questions are welcome." },
      { q: "Can I get product support in the group?", a: "Members and the team help with how-to questions. For anything about your account, billing or data, use the support chat in Yolias or the Contact page, so it stays private." },
      { q: "Can I share my own services or links?", a: "Share what you learned and what worked. Repeated self-promotion and spam are removed; partners share their referral links in their own channels." },
      { q: "What’s the difference between the community and the partner program?", a: "The community is for learning and sharing. The partner program is for people who recommend Yolias and want to earn a commission on paying customers they refer." },
      { q: "How do I suggest a feature?", a: "Post it in the group or send it from Yolias with Feedback / Report a Bug. The team reads every suggestion." },
    ],
    final: { title: "Ready to find your next customers?", body: "Join the community, then let Yolias find, research and reach the businesses you want to sell to.", primary: "Join the community", secondary: "See pricing" },
  },
  ar: {
    seoTitle: "مجتمع يولـياس | رواد أعمال وفرق مبيعات ينمون بالذكاء الاصطناعي",
    metaDescription: "انضم إلى مجتمع يولـياس على فيسبوك: رواد أعمال ومسوّقون وفرق مبيعات يتشاركون كيف يجدون العملاء ويكتبون رسائل التواصل وينمون بالذكاء الاصطناعي.",
    eyebrow: "المجتمع",
    title: "مرحبًا بك في مجتمع يولـياس",
    lead: "انمُ مع رواد أعمال ومسوّقين وفرق مبيعات يستخدمون الذكاء الاصطناعي لإيجاد العملاء وكسبهم. سواء كنت في البداية أو تدير فريق مبيعات كاملًا، لك مكان هنا.",
    join: "انضم إلى المجتمع على فيسبوك",
    secondary: "كن شريكًا",
    overview: "اسأل واحصل على إجابات من أشخاص يقومون بنفس العمل، وشارك ما ينجح في رسائل تواصلك، وشاهد ميزات يولـياس الجديدة أولًا، وأخبرنا بما نبنيه بعد ذلك — بالعربية والإنجليزية.",
    ways: [
      { title: "انضم عبر الإنترنت", body: "مجموعة يولـياس على فيسبوك هي المكان الذي يشارك فيه الأعضاء نجاحاتهم ويطلبون رأيًا في رسائلهم ويحصلون على المساعدة من الفريق ومن بعضهم.", link: "انضم إلى مجموعة فيسبوك", href: "community", external: true },
      { title: "تعلّم واحصل على المساعدة", body: "أدلة وتوثيق وإجابات للأسئلة الشائعة عن إيجاد العملاء والتواصل ووكيل يولـياس الذكي.", link: "افتح مركز المساعدة", href: "/help-center" },
      { title: "كن شريكًا", body: "صنّاع المحتوى والوكالات وقادة المجتمعات الذين يرشّحون يولـياس يربحون عمولة على كل عميل دافع يحيلونه.", link: "اكتشف برنامج الشركاء", href: "/affiliates" },
    ],
    events: {
      title: "نظّم جلسة عن يولـياس لمجتمعك",
      body: "استضف ورشة عمل أو عرضًا مباشرًا أو لقاءً عن المبيعات لمجموعة رواد الأعمال أو المسرّعة أو الطلاب، عبر الإنترنت أو حضوريًا. أخبرنا عنها وسيساعدك فريق يولـياس بالمحتوى وجولة في المنتج.",
      cta: "أخبرنا عن فعاليتك",
    },
    partner: {
      title: "شارك مع يولـياس",
      body: "الوكالات والمدربون والحاضنات وصنّاع المحتوى يمكنهم تقديم يولـياس للشركات التي يعملون معها، والربح من العملاء الذين يحيلونهم.",
      cta: "اكتشف الشراكات",
    },
    faqTitle: "أسئلة شائعة",
    faq: [
      { q: "من يمكنه الانضمام إلى مجتمع يولـياس؟", a: "كل من يهتم بإيجاد العملاء وتنمية عمله بالذكاء الاصطناعي: رواد الأعمال والمستقلون والمسوّقون وفرق المبيعات والوكالات. لا تحتاج إلى خطة في يولـياس للانضمام." },
      { q: "أين يجتمع المجتمع؟", a: "في مجموعة يولـياس على فيسبوك. اطلب الانضمام وسيوافق عليك أحد المشرفين." },
      { q: "هل له أي تكلفة؟", a: "لا. المجتمع مجاني." },
      { q: "ما اللغات المستخدمة؟", a: "العربية والإنجليزية. اكتب باللغة التي تريحك." },
      { q: "هل أحتاج خبرة في المبيعات أو الذكاء الاصطناعي؟", a: "لا. كثير من الأعضاء في البداية. اسأل أي شيء — أسئلة المبتدئين مرحب بها." },
      { q: "هل أحصل على دعم للمنتج في المجموعة؟", a: "يساعد الأعضاء والفريق في أسئلة الاستخدام. أما ما يخص حسابك أو الفوترة أو بياناتك فاستخدم محادثة الدعم في يولـياس أو صفحة التواصل حتى تبقى خاصة." },
      { q: "هل يمكنني مشاركة خدماتي أو روابطي؟", a: "شارك ما تعلّمته وما نجح معك. يُحذف الترويج الذاتي المتكرر والرسائل المزعجة، ويشارك الشركاء روابط الإحالة في قنواتهم الخاصة." },
      { q: "ما الفرق بين المجتمع وبرنامج الشركاء؟", a: "المجتمع للتعلّم والمشاركة. برنامج الشركاء لمن يرشّح يولـياس ويريد ربح عمولة على العملاء الدافعين الذين يحيلهم." },
      { q: "كيف أقترح ميزة؟", a: "انشرها في المجموعة أو أرسلها من يولـياس عبر «ملاحظات / الإبلاغ عن خطأ». يقرأ الفريق كل اقتراح." },
    ],
    final: { title: "مستعد لإيجاد عملائك القادمين؟", body: "انضم إلى المجتمع، ثم دَع يولـياس يجد الشركات التي تريد البيع لها ويبحث عنها ويتواصل معها.", primary: "انضم إلى المجتمع", secondary: "شاهد الأسعار" },
  },
};
