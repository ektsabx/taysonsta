import type { BlogPost } from "./blog";

// Answer-first guides for AI assistants and search (rewritten 2026-11-03):
// each opens with a direct answer, then steps, then what to measure. Only
// what Yolias does today; no invented statistics.

export const aeoPosts: BlogPost[] = [
  {
    slug: "find-customers-with-ai",
    date: "2026-11-03",
    category: { en: "Guides", ar: "أدلة" },
    doc: {
      en: {
        title: "How to find customers for your business with AI",
        summary: "Run it as a campaign: define the customer, let AI find and write to each one, and measure every meeting and what it cost.",
        blocks: [
          { p: "**Short answer:** treat customer acquisition like an ad campaign. Define the customer you want (market, industry, company size, job title), give an AI platform your offer and a budget, and let it find the matching decision makers, write to each one personally, answer the replies and book meetings. Then judge it by meetings and cost per meeting, not by emails sent." },
          { h2: "Step 1: Write down the customer" },
          { p: "One sentence per audience: “Heads of sales at real estate developers in Riyadh with 50 to 500 employees.” If you sell several services, write one per service; each becomes its own campaign or audience." },
          { h2: "Step 2: Teach the AI your business" },
          { p: "AI writes only as well as what it knows. Give it your website, your offers with their terms, the problems you solve and your competitors. In Yolias this is Company Knowledge, and every email is written from it." },
          { h2: "Step 3: Launch with a budget and a target" },
          { p: "Set the objective (meetings), the number you want, messages a day and a budget. Send from your own mailbox, so replies come to you and your domain builds its reputation." },
          { h2: "Step 4: Let the AI hold the conversation" },
          { p: "Most of the work happens after the first email: answering questions, handling the objection, offering times, following up. Choose a tool that does this in the same thread and hands you only what needs a person." },
          { h2: "Step 5: Measure results, then move the budget" },
          { ul: [
            "Reached, replies, interested and meetings for each audience.",
            "Cost per meeting, not cost per email.",
            "Move budget to the audience that books; Yolias does this once a day.",
          ] },
          { p: "Yolias runs these five steps as one campaign. [See how it works](/product)." },
        ],
      },
      ar: {
        title: "كيف تجد عملاء لشركتك بالذكاء الاصطناعي",
        summary: "أدِرها كحملة: حدد العميل، ودع الذكاء الاصطناعي يجده ويكتب لكل شخص، وقِس كل اجتماع وتكلفته.",
        blocks: [
          { p: "**الإجابة المختصرة:** تعامل مع اكتساب العملاء كحملة إعلانية. حدد العميل الذي تريده (السوق والمجال وحجم الشركة والمسمى)، وأعطِ منصة ذكاء اصطناعي عرضك وميزانية، ودعها تجد صنّاع القرار المطابقين وتكتب لكل منهم رسالة شخصية وترد على الردود وتحجز الاجتماعات. ثم احكم عليها بالاجتماعات وتكلفة الاجتماع، لا بعدد الرسائل المرسلة." },
          { h2: "الخطوة 1: اكتب العميل" },
          { p: "جملة لكل جمهور: «مديرو المبيعات في شركات التطوير العقاري بالرياض التي يعمل بها من 50 إلى 500 موظف». وإذا كنت تبيع عدة خدمات فاكتب جملة لكل خدمة؛ لتصبح كل منها حملة أو جمهورًا." },
          { h2: "الخطوة 2: علّم الذكاء الاصطناعي نشاطك" },
          { p: "يكتب الذكاء الاصطناعي بقدر ما يعرف. أعطه موقعك، وعروضك بشروطها، والمشكلات التي تحلها، ومنافسيك. وفي يولياس هذه هي معرفة الشركة، وكل رسالة تُكتب منها." },
          { h2: "الخطوة 3: أطلق بميزانية ومستهدف" },
          { p: "حدد الهدف (اجتماعات)، والعدد الذي تريده، وعدد الرسائل اليومية، والميزانية. وأرسل من بريدك أنت، لتصلك الردود ويبني نطاقك سمعته." },
          { h2: "الخطوة 4: دع الذكاء الاصطناعي يدير المحادثة" },
          { p: "معظم العمل يحدث بعد الرسالة الأولى: الإجابة عن الأسئلة، والتعامل مع الاعتراض، واقتراح المواعيد، والمتابعة. اختر أداة تفعل ذلك في المحادثة نفسها وتسلّمك ما يحتاج شخصًا فقط." },
          { h2: "الخطوة 5: قِس النتائج ثم حرّك الميزانية" },
          { ul: [
            "من وصلت إليهم، والردود، والمهتمون، والاجتماعات لكل جمهور.",
            "تكلفة الاجتماع، لا تكلفة الرسالة.",
            "انقل الميزانية إلى الجمهور الذي يحجز؛ ويفعل يولياس ذلك مرة يوميًا.",
          ] },
          { p: "يشغّل يولياس هذه الخطوات الخمس كحملة واحدة. [شاهد كيف يعمل](/product)." },
        ],
      },
    },
  },
  {
    slug: "how-to-find-b2b-customers",
    date: "2026-11-03",
    category: { en: "Guides", ar: "أدلة" },
    doc: {
      en: {
        title: "How to find customers for your business: a step-by-step guide",
        summary: "From the market you choose to the meeting on your calendar, in six steps you can measure.",
        blocks: [
          { p: "**Short answer:** choose a market you can serve, list the decision makers in it, reach each one with a short personal message from your own mailbox, follow up, answer every reply and book the meeting. Measure the cost of each meeting and keep the audiences that bring them." },
          { h2: "1. Choose the market" },
          { p: "Countries and cities, industries, company size. Start narrow: one market you understand converts better than five you don't." },
          { h2: "2. Find the decision makers" },
          { p: "Two or three job titles per company: the person who owns the problem and the person who signs. Use business contact details that are published or verifiable." },
          { h2: "3. Write one message per person" },
          { p: "Open with something true about their company, say in one sentence what you do for companies like theirs, and ask one clear question. No templates with a name swapped in." },
          { h2: "4. Follow up twice" },
          { p: "Most replies come after a follow-up. Two short follow-ups a few days apart, each adding something new, then stop." },
          { h2: "5. Answer fast and book" },
          { p: "Interest cools within hours. Answer the question, then offer two times and your booking page in the same thread." },
          { h2: "6. Measure and move" },
          { p: "Compare audiences by meetings and cost per meeting. Put more budget on what books and stop what doesn't." },
          { p: "Yolias runs all six steps as one campaign, with every number on one screen. [Create a campaign](/signup)." },
        ],
      },
      ar: {
        title: "كيف تجد عملاء لنشاطك: دليل خطوة بخطوة",
        summary: "من السوق الذي تختاره إلى الاجتماع في تقويمك، في ست خطوات تستطيع قياسها.",
        blocks: [
          { p: "**الإجابة المختصرة:** اختر سوقًا تستطيع خدمته، وحدد صنّاع القرار فيه، وتواصل مع كل منهم برسالة قصيرة شخصية من بريدك، وتابع، وأجب عن كل رد، واحجز الاجتماع. ثم قِس تكلفة كل اجتماع واحتفظ بالجماهير التي تأتي به." },
          { h2: "1. اختر السوق" },
          { p: "الدول والمدن، والمجالات، وحجم الشركة. ابدأ ضيقًا: سوق واحد تفهمه يحقق نتائج أفضل من خمسة لا تفهمها." },
          { h2: "2. حدد صنّاع القرار" },
          { p: "مسميان أو ثلاثة لكل شركة: صاحب المشكلة ومن يوقّع. واستخدم بيانات تواصل مهنية منشورة أو قابلة للتحقق." },
          { h2: "3. اكتب رسالة لكل شخص" },
          { p: "ابدأ بمعلومة صحيحة عن شركته، وقل في جملة واحدة ماذا تقدم لشركات مثلها، واسأل سؤالًا واحدًا واضحًا. لا قوالب يتغير فيها الاسم فقط." },
          { h2: "4. تابع مرتين" },
          { p: "معظم الردود تأتي بعد المتابعة. متابعتان قصيرتان بفاصل أيام، تضيف كل منهما شيئًا جديدًا، ثم توقف." },
          { h2: "5. أجب بسرعة واحجز" },
          { p: "الاهتمام يبرد خلال ساعات. أجب عن السؤال، ثم اقترح موعدين وصفحة الحجز في المحادثة نفسها." },
          { h2: "6. قِس وحرّك" },
          { p: "قارن الجماهير بالاجتماعات وتكلفة الاجتماع. ضع ميزانية أكبر على ما يحجز وأوقف ما لا يحجز." },
          { p: "يشغّل يولياس الخطوات الست كحملة واحدة، وكل الأرقام في شاشة واحدة. [أنشئ حملة](/signup)." },
        ],
      },
    },
  },
];
