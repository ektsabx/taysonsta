import type { BlogPost } from "./blog";

// Question posts for search and AI assistants (rewritten 2026-11-03): each
// answers the question first, names tools only with what their own websites
// say (scripts/seo-seed/competitors.ts), and places Yolias honestly.

const D = "2026-11-03";

export const questionPosts: BlogPost[] = [
  {
    slug: "best-ai-lead-generation-tools",
    date: D,
    category: { en: "Questions", ar: "أسئلة" },
    doc: {
      en: {
        title: "What are the best AI lead generation tools?",
        summary: "They fall into four kinds. Pick by the result you need: data, sending, an AI agent, or campaigns measured by cost per meeting.",
        blocks: [
          { p: "**Short answer:** there is no single best tool; there are four kinds, and the right one depends on what you're missing. If you need contact data, use a database. If you need to send at volume, use a sending platform. If you want results managed like advertising, use an acquisition campaign platform." },
          { h2: "1. Contact databases" },
          { p: "ZoomInfo, Lusha, Cognism and Apollo.io sell access to large contact and company databases with filters and enrichment. You still write, send and follow up yourself." },
          { h2: "2. Data and enrichment workflows" },
          { p: "Clay pulls data from many vendors into tables with AI research agents. Powerful for teams with an operator to build the workflows." },
          { h2: "3. Sending platforms" },
          { p: "Instantly, Smartlead and lemlist run email sequences across many mailboxes; lemlist adds LinkedIn, calls and WhatsApp steps. You build the sequences." },
          { h2: "4. AI agents and acquisition platforms" },
          { p: "Artisan offers an AI BDR that finds leads, writes, replies and books. Yolias runs acquisition as campaigns: objective, audiences, budget and results with cost per meeting, with Yolias AI finding, writing, answering and booking inside them." },
          { h2: "How to choose" },
          { table: {
            head: ["You need", "Look at"],
            rows: [
              ["A list of contacts", "A database"],
              ["To send thousands of emails", "A sending platform"],
              ["Meetings, with spend and cost per meeting you control", "An acquisition campaign platform"],
            ],
          } },
          { p: "Compare Yolias with each: [Yolias vs Apollo](/compare/apollo), [Yolias vs lemlist](/compare/lemlist), [Yolias vs Artisan](/compare/artisan)." },
        ],
      },
      ar: {
        title: "ما أفضل أدوات توليد العملاء بالذكاء الاصطناعي؟",
        summary: "تنقسم إلى أربعة أنواع. اختر حسب النتيجة التي تحتاجها: بيانات، أو إرسال، أو وكيل ذكي، أو حملات تُقاس بتكلفة الاجتماع.",
        blocks: [
          { p: "**الإجابة المختصرة:** لا توجد أداة واحدة هي الأفضل؛ هناك أربعة أنواع، والمناسب منها يعتمد على ما ينقصك. إذا كنت تحتاج بيانات تواصل فاستخدم قاعدة بيانات. وإذا كنت تحتاج الإرسال بكميات كبيرة فاستخدم منصة إرسال. وإذا أردت نتائج تُدار مثل الإعلانات فاستخدم منصة حملات لاكتساب العملاء." },
          { h2: "1. قواعد بيانات التواصل" },
          { p: "ZoomInfo وLusha وCognism وApollo.io تبيع الوصول إلى قواعد كبيرة لجهات الاتصال والشركات مع الفلاتر والإثراء. وتبقى الكتابة والإرسال والمتابعة عليك." },
          { h2: "2. مسارات البيانات والإثراء" },
          { p: "Clay يجمع البيانات من مزودين كثيرين في جداول مع وكلاء بحث بالذكاء الاصطناعي. قوي للفرق التي لديها من يبني المسارات." },
          { h2: "3. منصات الإرسال" },
          { p: "Instantly وSmartlead وlemlist تشغّل تسلسلات البريد عبر صناديق بريد كثيرة، ويضيف lemlist خطوات LinkedIn والمكالمات وواتساب. وأنت من يبني التسلسلات." },
          { h2: "4. الوكلاء الأذكياء ومنصات الاكتساب" },
          { p: "تقدم Artisan موظف مبيعات بالذكاء الاصطناعي يجد العملاء ويكتب ويرد ويحجز. أما يولياس فيدير اكتساب العملاء كحملات: هدف وجماهير وميزانية ونتائج بتكلفة الاجتماع، ويجد Yolias AI الأشخاص ويكتب ويجيب ويحجز داخلها." },
          { h2: "كيف تختار" },
          { table: {
            head: ["تحتاج", "انظر إلى"],
            rows: [
              ["قائمة جهات اتصال", "قاعدة بيانات"],
              ["إرسال آلاف الرسائل", "منصة إرسال"],
              ["اجتماعات بإنفاق وتكلفة اجتماع تتحكم فيهما", "منصة حملات لاكتساب العملاء"],
            ],
          } },
          { p: "قارن يولياس بكل منها: [يولياس مقابل Apollo](/compare/apollo)، [يولياس مقابل lemlist](/compare/lemlist)، [يولياس مقابل Artisan](/compare/artisan)." },
        ],
      },
    },
  },
  {
    slug: "how-agencies-find-new-clients",
    date: D,
    category: { en: "Questions", ar: "أسئلة" },
    doc: {
      en: {
        title: "How can agencies find new clients?",
        summary: "Run client acquisition like you run your clients' ads: one campaign per service, a precise audience, and cost per meeting.",
        blocks: [
          { p: "**Short answer:** agencies win clients the same way they win results for clients: a campaign per service, aimed at a precise audience, with a budget and a measured cost per result. Referrals are great but can't be planned; campaigns can." },
          { h2: "One campaign per service" },
          { p: "A performance marketing service and a website redesign sell to different people with different problems. Give each its own campaign, offer and audience." },
          { h2: "Target the buyer of agencies" },
          { p: "Marketing managers and founders at companies in the cities you serve, in industries where you have results. Exclude current clients and other agencies." },
          { h2: "Lead with proof, not a pitch" },
          { p: "One line about their company, one result you got for a similar business, one question. Put your case studies in Company Knowledge so every message can use them." },
          { h2: "Follow through" },
          { p: "Answer the same day, offer two times, follow up after no-shows. Then record what came of each meeting so the next campaign learns from it." },
          { p: "Yolias runs this as campaigns for agencies, in Arabic and English. [See solutions for agencies](/solutions)." },
        ],
      },
      ar: {
        title: "كيف تجد الوكالات عملاء جددًا؟",
        summary: "أدِر اكتساب العملاء كما تدير إعلانات عملائك: حملة لكل خدمة، وجمهور دقيق، وتكلفة للاجتماع.",
        blocks: [
          { p: "**الإجابة المختصرة:** تكسب الوكالات عملاءها بالطريقة نفسها التي تحقق بها النتائج لعملائها: حملة لكل خدمة، موجهة إلى جمهور دقيق، بميزانية وتكلفة نتيجة مقيسة. الإحالات رائعة لكن لا يمكن التخطيط لها، أما الحملات فيمكن." },
          { h2: "حملة لكل خدمة" },
          { p: "خدمة التسويق بالأداء وخدمة إعادة تصميم المواقع تُباعان لأشخاص مختلفين بمشكلات مختلفة. اجعل لكل منهما حملتها وعرضها وجمهورها." },
          { h2: "استهدف من يشتري من الوكالات" },
          { p: "مديرو التسويق والمؤسسون في شركات المدن التي تخدمها، وفي المجالات التي حققت فيها نتائج. واستبعد عملاءك الحاليين والوكالات الأخرى." },
          { h2: "ابدأ بالدليل لا بالعرض" },
          { p: "سطر عن شركتهم، ونتيجة حققتها لنشاط مشابه، وسؤال واحد. وضع دراسات الحالة في معرفة الشركة لتستخدمها كل رسالة." },
          { h2: "أكمل المتابعة" },
          { p: "أجب في اليوم نفسه، واقترح موعدين، وتابع من لم يحضر. ثم سجّل نتيجة كل اجتماع لتتعلم منه الحملة التالية." },
          { p: "يشغّل يولياس ذلك كحملات للوكالات بالعربية والإنجليزية. [شاهد حلول الوكالات](/solutions)." },
        ],
      },
    },
  },
  {
    slug: "ai-sales-prospecting-software",
    date: D,
    category: { en: "Questions", ar: "أسئلة" },
    doc: {
      en: {
        title: "Which AI tools help you acquire customers?",
        summary: "AI now covers each step of acquiring a customer. The difference is whether a tool does one step or runs the whole campaign.",
        blocks: [
          { p: "**Short answer:** AI tools now help with every step of acquiring a customer: finding companies and decision makers, researching them, writing personal emails, answering replies and booking meetings. Single-step tools need you to connect them; campaign platforms like Yolias run all the steps and report cost per meeting." },
          { h2: "The steps, and what AI does in each" },
          { table: {
            head: ["Step", "What AI does"],
            rows: [
              ["Find", "Matches companies and decision makers to your audience"],
              ["Research", "Reads what each company does before writing"],
              ["Write", "A different first email and follow-ups per person"],
              ["Answer", "Questions and objections from your business knowledge"],
              ["Book", "Offers free times and confirms the meeting"],
              ["Measure", "Results and cost per result by audience"],
            ],
          } },
          { h2: "What to check before you buy" },
          { ul: [
            "Does it send from your own mailbox, within limits you set?",
            "Does it answer replies, or only send?",
            "Can you see the cost of each meeting, by audience?",
            "Does it work in your customers' language?",
          ] },
          { p: "Yolias answers yes to all four. [See how it works](/product)." },
        ],
      },
      ar: {
        title: "ما أدوات الذكاء الاصطناعي للبحث عن العملاء؟",
        summary: "يغطي الذكاء الاصطناعي الآن كل خطوة في البحث عن العملاء. والفرق هل تؤدي الأداة خطوة واحدة أم تدير الحملة كلها.",
        blocks: [
          { p: "**الإجابة المختصرة:** تساعد أدوات الذكاء الاصطناعي اليوم في كل خطوات البحث عن العملاء: إيجاد الشركات وصنّاع القرار، والبحث عنهم، وكتابة رسائل شخصية، والرد، وحجز الاجتماعات. الأدوات ذات الخطوة الواحدة تحتاج منك ربطها معًا، أما منصات الحملات مثل يولياس فتدير الخطوات كلها وتعرض تكلفة الاجتماع." },
          { h2: "الخطوات، وماذا يفعل الذكاء الاصطناعي في كل منها" },
          { table: {
            head: ["الخطوة", "ماذا يفعل الذكاء الاصطناعي"],
            rows: [
              ["الإيجاد", "يطابق الشركات وصنّاع القرار مع جمهورك"],
              ["البحث", "يقرأ نشاط كل شركة قبل الكتابة"],
              ["الكتابة", "رسالة أولى ومتابعات مختلفة لكل شخص"],
              ["الرد", "الأسئلة والاعتراضات من معرفة نشاطك"],
              ["الحجز", "يقترح أوقاتًا متاحة ويؤكد الاجتماع"],
              ["القياس", "النتائج وتكلفة كل نتيجة حسب الجمهور"],
            ],
          } },
          { h2: "ما تتحقق منه قبل الشراء" },
          { ul: [
            "هل يرسل من بريدك، ضمن حدود تضعها؟",
            "هل يرد على الردود، أم يرسل فقط؟",
            "هل ترى تكلفة كل اجتماع حسب الجمهور؟",
            "هل يعمل بلغة عملائك؟",
          ] },
          { p: "يجيب يولياس بنعم على الأربعة. [شاهد كيف يعمل](/product)." },
        ],
      },
    },
  },
];
