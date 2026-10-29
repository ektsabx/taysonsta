import type { Localized } from "./types";

// /community: the Yolias community only (owner, 2026-10-28: each page serves
// its own topic, nothing about partners or the affiliate program here). The
// community is the Yolias Facebook group (COMMUNITY_URL). Only what is true of
// the group is said: no member counts, no events that don't exist.

export interface CommunityCopy {
  seoTitle: string; metaDescription: string;
  eyebrow: string; title: string; lead: string; join: string;
  overview: string;
  waysTitle: string;
  ways: { title: string; body: string }[];
  forTitle: string; forList: string[];
  startTitle: string; steps: { title: string; body: string }[];
  rulesTitle: string; rulesLead: string; rules: string[];
  faqTitle: string; faq: { q: string; a: string }[];
  final: { title: string; body: string; primary: string };
}

export const communityPage: Localized<CommunityCopy> = {
  en: {
    seoTitle: "Yolias Community | Finding B2B customers with AI",
    metaDescription: "The Yolias community on Facebook: founders, agencies and sales teams sharing what works to find B2B customers with AI, in English and Arabic.",
    eyebrow: "COMMUNITY",
    title: "The Yolias community",
    lead: "A group for people who sell to businesses: founders, freelancers, agencies and sales teams who want to find the right customers and write outreach that gets answered. Free, in English and Arabic.",
    join: "Join the group on Facebook",
    overview: "Finding customers is easier when you can ask someone who did it last week. In the group, members ask questions, post the email they're about to send and get feedback, share what worked in their market, and tell the Yolias team what to build next.",
    waysTitle: "What happens in the group",
    ways: [
      { title: "Ask anything", body: "How to describe your ideal customer, which job titles decide in your market, how many follow-ups are too many. Members and the Yolias team answer." },
      { title: "Get feedback on your outreach", body: "Post a first email or a follow-up (without your lead's personal data) and get honest notes on the subject line, the length and the ask." },
      { title: "Share what works", body: "Reply rates by market, an opening line that worked in Riyadh or Cairo, a niche that answered better than expected. Real results help everyone." },
      { title: "See new features first", body: "New Yolias features are announced in the group first, and members' suggestions go straight to the team that builds them." },
    ],
    forTitle: "Who it's for",
    forList: [
      "Founders who do their own sales and need a steady flow of B2B customers.",
      "Freelancers and agencies looking for clients in Egypt, the Gulf and beyond.",
      "Sales and business development teams who want better lists and better first emails.",
      "Anyone starting out: beginners' questions are welcome. You don't need a Yolias account to join.",
    ],
    startTitle: "How to start",
    steps: [
      { title: "Ask to join", body: "Open the group on Facebook and press Join. A moderator approves new members." },
      { title: "Introduce yourself", body: "Say what you sell, who you sell to and in which market. Members can then point you to what helped them." },
      { title: "Post your first question", body: "Give context: your customer, your market and what you tried. Specific questions get the most useful answers." },
    ],
    rulesTitle: "Group guidelines",
    rulesLead: "A few rules keep the group useful for everyone:",
    rules: [
      "Be respectful. Disagree with ideas, not with people.",
      "No spam and no repeated self-promotion. Share what you learned, not ads.",
      "Never post anyone's personal data: no lead lists, emails or phone numbers of real people.",
      "No selling or swapping contact lists.",
      "Account, billing or data questions go to Yolias support in the app, so they stay private.",
    ],
    faqTitle: "Frequently asked questions",
    faq: [
      { q: "Who can join the Yolias community?", a: "Anyone who sells to businesses or wants to: founders, freelancers, agencies, marketers and sales teams. You don't need a Yolias account to join." },
      { q: "Where does the community meet?", a: "In the Yolias Facebook group. Ask to join and a moderator approves you." },
      { q: "Does it cost anything?", a: "No. The community is free." },
      { q: "Which languages are used?", a: "English and Arabic. Write in the one you're most comfortable with." },
      { q: "Do I need experience in sales or AI?", a: "No. Many members are just starting out, and beginners' questions are welcome." },
      { q: "Can I get product support in the group?", a: "Members and the team help with how-to questions. For anything about your account, billing or data, use the support chat in Yolias or the Contact page, so it stays private." },
      { q: "Can I post my own services?", a: "Share what you learned and what worked. Repeated self-promotion and spam are removed." },
      { q: "How do I suggest a feature?", a: "Post it in the group, or send it from Yolias with Feedback / Report a Bug. The team reads every suggestion." },
    ],
    final: { title: "Find customers with people doing the same", body: "Join the group, introduce yourself and ask your first question today.", primary: "Join the group on Facebook" },
  },
  ar: {
    seoTitle: "مجتمع يولياس | إيجاد عملاء الشركات بالذكاء الاصطناعي",
    metaDescription: "مجتمع يولياس على فيسبوك: رواد أعمال ووكالات وفرق مبيعات يتشاركون ما ينجح في إيجاد عملاء الشركات بالذكاء الاصطناعي، بالعربية والإنجليزية.",
    eyebrow: "المجتمع",
    title: "مجتمع يولياس",
    lead: "مجموعة لمن يبيع للشركات: رواد أعمال ومستقلون ووكالات وفرق مبيعات يريدون إيجاد العملاء المناسبين وكتابة رسائل يُرد عليها. مجانية، بالعربية والإنجليزية.",
    join: "انضم إلى المجموعة على فيسبوك",
    overview: "إيجاد العملاء أسهل عندما تسأل شخصًا فعلها الأسبوع الماضي. في المجموعة يسأل الأعضاء، وينشرون الرسالة التي سيرسلونها ويأخذون رأيًا فيها، ويتشاركون ما نجح في سوقهم، ويخبرون فريق يولياس بما يبنيه بعد ذلك.",
    waysTitle: "ماذا يحدث في المجموعة",
    ways: [
      { title: "اسأل أي شيء", body: "كيف تصف عميلك المثالي، ومن يتخذ القرار في سوقك، وكم متابعة تكفي. يجيب الأعضاء وفريق يولياس." },
      { title: "رأي في رسائلك", body: "انشر رسالتك الأولى أو المتابعة (بدون بيانات شخصية لعملائك) وخذ ملاحظات صريحة على العنوان والطول والطلب." },
      { title: "شارك ما ينجح", body: "نسب الرد في كل سوق، وجملة افتتاحية نجحت في الرياض أو القاهرة، ومجال ردّ أفضل من المتوقع. النتائج الحقيقية تفيد الجميع." },
      { title: "الميزات الجديدة أولًا", body: "تُعلن ميزات يولياس الجديدة في المجموعة أولًا، واقتراحات الأعضاء تصل مباشرة للفريق الذي يبنيها." },
    ],
    forTitle: "لمن هذا المجتمع",
    forList: [
      "رواد الأعمال الذين يبيعون بأنفسهم ويحتاجون تدفقًا ثابتًا من عملاء الشركات.",
      "المستقلون والوكالات الذين يبحثون عن عملاء في مصر والخليج وغيرها.",
      "فرق المبيعات وتطوير الأعمال التي تريد قوائم أفضل ورسائل أولى أفضل.",
      "كل من يبدأ: أسئلة المبتدئين مرحب بها، ولا تحتاج حسابًا في يولياس للانضمام.",
    ],
    startTitle: "كيف تبدأ",
    steps: [
      { title: "اطلب الانضمام", body: "افتح المجموعة على فيسبوك واضغط «انضمام». يوافق أحد المشرفين على الأعضاء الجدد." },
      { title: "عرّف بنفسك", body: "قل ماذا تبيع، ولمن، وفي أي سوق. هكذا يدلّك الأعضاء على ما ساعدهم." },
      { title: "انشر سؤالك الأول", body: "أعطِ السياق: عميلك وسوقك وما جربته. الأسئلة المحددة تحصل على أنفع الإجابات." },
    ],
    rulesTitle: "قواعد المجموعة",
    rulesLead: "قواعد قليلة تُبقي المجموعة مفيدة للجميع:",
    rules: [
      "الاحترام أولًا. اختلف مع الأفكار، لا مع الأشخاص.",
      "لا رسائل مزعجة ولا ترويج ذاتي متكرر. شارك ما تعلّمته، لا الإعلانات.",
      "لا تنشر بيانات شخصية لأي أحد: لا قوائم عملاء ولا بريد ولا أرقام هواتف لأشخاص حقيقيين.",
      "لا بيع ولا تبادل لقوائم جهات الاتصال.",
      "أسئلة الحساب والفوترة والبيانات مكانها دعم يولياس داخل التطبيق، حتى تبقى خاصة.",
    ],
    faqTitle: "أسئلة شائعة",
    faq: [
      { q: "من يمكنه الانضمام إلى مجتمع يولياس؟", a: "كل من يبيع للشركات أو يريد ذلك: رواد الأعمال والمستقلون والوكالات والمسوّقون وفرق المبيعات. لا تحتاج حسابًا في يولياس للانضمام." },
      { q: "أين يجتمع المجتمع؟", a: "في مجموعة يولياس على فيسبوك. اطلب الانضمام وسيوافق عليك أحد المشرفين." },
      { q: "هل له أي تكلفة؟", a: "لا. المجتمع مجاني." },
      { q: "ما اللغات المستخدمة؟", a: "العربية والإنجليزية. اكتب باللغة التي تريحك." },
      { q: "هل أحتاج خبرة في المبيعات أو الذكاء الاصطناعي؟", a: "لا. كثير من الأعضاء في البداية، وأسئلة المبتدئين مرحب بها." },
      { q: "هل أحصل على دعم للمنتج في المجموعة؟", a: "يساعد الأعضاء والفريق في أسئلة الاستخدام. أما ما يخص حسابك أو الفوترة أو بياناتك فاستخدم محادثة الدعم في يولياس أو صفحة التواصل حتى تبقى خاصة." },
      { q: "هل يمكنني نشر خدماتي؟", a: "شارك ما تعلّمته وما نجح معك. يُحذف الترويج الذاتي المتكرر والرسائل المزعجة." },
      { q: "كيف أقترح ميزة؟", a: "انشرها في المجموعة، أو أرسلها من يولياس عبر «ملاحظات / الإبلاغ عن خطأ». يقرأ الفريق كل اقتراح." },
    ],
    final: { title: "ابحث عن العملاء مع من يفعل مثلك", body: "انضم إلى المجموعة، وعرّف بنفسك، واسأل سؤالك الأول اليوم.", primary: "انضم إلى المجموعة على فيسبوك" },
  },
};
