import type { BlogPost } from "./blog";

// Long-form guides (rewritten 2026-11-03 for the campaign platform). No
// invented statistics; only what Yolias does today.

export const guidePosts: BlogPost[] = [
  {
    slug: "ai-sales-automation-guide",
    date: "2026-11-03",
    category: { en: "Guides", ar: "أدلة" },
    doc: {
      en: {
        title: "AI sales automation: a practical guide for growing businesses",
        summary: "What to automate, what to keep human, and how to judge it by meetings and cost per meeting.",
        blocks: [
          { p: "AI can now do most of the repetitive work between “who should we sell to” and “a meeting on the calendar”. The teams that get results from it automate the work, not the judgment, and measure it like advertising." },
          { h2: "What AI does well" },
          { ul: [
            "**Finding** the companies and decision makers that match an audience, every day.",
            "**Researching** each company before writing.",
            "**Writing** a first email and follow-ups for each person, in their language.",
            "**Answering** common questions and objections from what you taught it.",
            "**Booking**: offering free times and confirming a time the person names.",
          ] },
          { h2: "What stays with you" },
          { ul: [
            "Choosing the market and the offer.",
            "Negotiation, pricing exceptions and complaints.",
            "The meeting itself, and what came of it.",
          ] },
          { h2: "Run it as campaigns" },
          { p: "Automation without structure becomes volume. Give each offer or market its own campaign with an objective, audiences and a budget, and compare campaigns by results. This is how ad platforms work, and it's how Yolias works: Yolias AI does the work inside campaigns you control." },
          { h2: "Protect your reputation" },
          { ul: [
            "Send from your own mailbox, within a daily limit, in business hours.",
            "Stop contacting anyone who asks, and suppress bounced addresses.",
            "Use only business contact details that are published or verifiable.",
          ] },
          { h2: "Measure what matters" },
          { p: "Count meetings and their cost, then positive replies. Opens and sends are activity, not results. Move budget toward audiences that book, and keep the ones that don't for learning only." },
          { p: "[See how Yolias runs a campaign](/product)." },
        ],
      },
      ar: {
        title: "أتمتة المبيعات بالذكاء الاصطناعي: دليل عملي للأعمال النامية",
        summary: "ماذا تؤتمت، وماذا تُبقي للإنسان، وكيف تحكم عليها بالاجتماعات وتكلفة الاجتماع.",
        blocks: [
          { p: "يستطيع الذكاء الاصطناعي اليوم أداء معظم العمل المتكرر بين «لمن نبيع؟» و«اجتماع في التقويم». والفرق التي تحقق نتائج منه تؤتمت العمل لا القرار، وتقيسه كما تقيس الإعلانات." },
          { h2: "ما يجيده الذكاء الاصطناعي" },
          { ul: [
            "**الإيجاد**: الشركات وصنّاع القرار المطابقون للجمهور، كل يوم.",
            "**البحث** عن كل شركة قبل الكتابة.",
            "**الكتابة**: رسالة أولى ومتابعات لكل شخص بلغته.",
            "**الإجابة** عن الأسئلة والاعتراضات الشائعة مما علّمته.",
            "**الحجز**: اقتراح أوقات متاحة وتأكيد الموعد الذي يذكره الشخص.",
          ] },
          { h2: "ما يبقى لك" },
          { ul: [
            "اختيار السوق والعرض.",
            "التفاوض واستثناءات السعر والشكاوى.",
            "الاجتماع نفسه، وما نتج عنه.",
          ] },
          { h2: "أدِرها كحملات" },
          { p: "الأتمتة بلا هيكل تتحول إلى كمية. اجعل لكل عرض أو سوق حملته بهدف وجماهير وميزانية، وقارن الحملات بنتائجها. هكذا تعمل منصات الإعلانات، وهكذا يعمل يولياس: يؤدي Yolias AI العمل داخل حملات تتحكم فيها." },
          { h2: "احمِ سمعتك" },
          { ul: [
            "أرسل من بريدك، ضمن حد يومي، في ساعات العمل.",
            "أوقف التواصل مع من يطلب ذلك، واستبعد العناوين المرتدة.",
            "استخدم بيانات تواصل مهنية منشورة أو قابلة للتحقق فقط.",
          ] },
          { h2: "قِس ما يهم" },
          { p: "احسب الاجتماعات وتكلفتها، ثم الردود الإيجابية. الفتح والإرسال نشاط لا نتائج. وجّه الميزانية نحو الجماهير التي تحجز، واحتفظ بغيرها للتعلم فقط." },
          { p: "[شاهد كيف يدير يولياس الحملة](/product)." },
        ],
      },
    },
  },
  {
    slug: "reduce-customer-acquisition-cost",
    date: "2026-11-03",
    category: { en: "Guides", ar: "أدلة" },
    doc: {
      en: {
        title: "How to lower your customer acquisition cost (CAC)",
        summary: "Measure CAC per campaign and audience, then cut it at the three places it leaks: the audience, the message and the follow-through.",
        blocks: [
          { p: "Customer acquisition cost is everything you spent to win customers in a period divided by the customers you won. A single company-wide CAC hides where money is wasted; measure it per campaign and per audience." },
          { h2: "Measure it where it's made" },
          { ul: [
            "Spend per campaign and per audience.",
            "Cost per interested reply, cost per meeting, cost per customer.",
            "Match the cost period to when those customers actually closed; Larger deals take time.",
          ] },
          { h2: "Leak 1: the audience" },
          { p: "The cheapest meeting comes from a precise audience. Narrow the market, target the titles that own the problem, exclude current customers and competitors, and compare two or three audiences instead of one broad one." },
          { h2: "Leak 2: the message" },
          { p: "Generic messages buy silence. A message about the person's company, one clear offer and one question wins more replies for the same spend." },
          { h2: "Leak 3: the follow-through" },
          { p: "Interested people lost to a slow answer are the most expensive leak. Answer the same day, offer times in the thread, follow up after no-shows." },
          { h2: "Then move the budget" },
          { p: "Every week, move budget from the audience with the highest cost per meeting to the lowest. Yolias does this every day for each campaign and shows the split on the campaign page." },
          { p: "[See Yolias pricing](/pricing)." },
        ],
      },
      ar: {
        title: "كيف تخفض تكلفة اكتساب العملاء (CAC)",
        summary: "قِس تكلفة الاكتساب لكل حملة وجمهور، ثم اخفضها في المواضع الثلاثة التي تتسرب منها: الجمهور والرسالة والمتابعة.",
        blocks: [
          { p: "تكلفة اكتساب العميل هي كل ما أنفقته لكسب العملاء في فترة مقسومًا على عدد العملاء الذين كسبتهم. والرقم الواحد على مستوى الشركة يخفي أين تُهدر الأموال؛ لذا قِسه لكل حملة ولكل جمهور." },
          { h2: "قِسها حيث تُصنع" },
          { ul: [
            "الإنفاق لكل حملة ولكل جمهور.",
            "تكلفة الرد المهتم، وتكلفة الاجتماع، وتكلفة العميل.",
            "طابق فترة التكلفة مع وقت إغلاق تلك الصفقات فعلًا؛ فالصفقات الكبيرة تأخذ وقتًا.",
          ] },
          { h2: "التسرب 1: الجمهور" },
          { p: "أرخص اجتماع يأتي من جمهور دقيق. ضيّق السوق، واستهدف المسميات المسؤولة عن المشكلة، واستبعد العملاء الحاليين والمنافسين، وقارن جمهورين أو ثلاثة بدل جمهور واحد واسع." },
          { h2: "التسرب 2: الرسالة" },
          { p: "الرسائل العامة تشتري الصمت. رسالة عن شركة الشخص، بعرض واحد واضح وسؤال واحد، تحقق ردودًا أكثر بالإنفاق نفسه." },
          { h2: "التسرب 3: المتابعة" },
          { p: "المهتمون الذين تخسرهم بسبب بطء الرد هم أغلى تسرب. أجب في اليوم نفسه، واقترح المواعيد في المحادثة، وتابع من لم يحضر." },
          { h2: "ثم حرّك الميزانية" },
          { p: "كل أسبوع انقل الميزانية من الجمهور الأعلى تكلفة للاجتماع إلى الأقل. ويفعل يولياس ذلك يوميًا لكل حملة، ويعرض التوزيع في صفحة الحملة." },
          { p: "[اطّلع على أسعار يولياس](/pricing)." },
        ],
      },
    },
  },
];
