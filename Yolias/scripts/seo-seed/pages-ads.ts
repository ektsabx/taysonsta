import type { SeedPage } from "./types.ts";
import type { SeedCompetitor } from "./competitors.ts";

// Yolias next to the ad platforms (owner, 2026-11-02, D-275): Yolias is an AI
// advertising platform for customer acquisition, so people searching
// "Facebook ads alternative", "Google Ads vs …" or "إعلانات تيك توك" should
// find an honest comparison. Each platform is described only from its own
// business pages (the sources below): an auction, objectives, targeting and
// measurement. No prices are quoted (ad prices are set by auction), and no
// page says Yolias replaces ads: it adds a channel that starts from the
// customer instead of the audience.

type L = { en: string; ar: string };
type LL = { en: string[]; ar: string[] };
const D = "2026-11-02";
const fact = (key: string, en: string, ar: string, source_url: string) => ({ key, value: { en, ar }, source_url, checked_at: D, verified: false as const });

interface Platform {
  slug: string; name: string; nameAr: string; website: string; pricing_url: string;
  keyword: string; secondary: string[];
  summary: L; best_for: L; strengths: LL; limits: LL;
  them: Record<Row, L>;
  lead: L; answer: L;
  chooseThem: LL; together: L;
  faq: { en: { q: string; a: string }[]; ar: { q: string; a: string }[] };
  sources: string[];
}

type Row = "starts" | "reach" | "pay" | "after" | "results" | "fit";
const labels: Record<Row, L> = {
  starts: { en: "Where a campaign starts", ar: "من أين تبدأ الحملة" },
  reach: { en: "Who it reaches", ar: "من تصل إليه" },
  pay: { en: "What you pay for", ar: "مقابل ماذا تدفع" },
  after: { en: "After the first contact", ar: "بعد أول تواصل" },
  results: { en: "Results it measures", ar: "النتائج التي تقيسها" },
  fit: { en: "Best at", ar: "أفضل ما تقدمه" },
};
const rows: Row[] = ["starts", "reach", "pay", "after", "results", "fit"];

const Y: Record<Row, L> = {
  starts: { en: "The customers you define: countries and cities, industries, company size, job titles and exclusions, or a lookalike of your best customers", ar: "العملاء الذين تحددهم: الدول والمدن، والمجالات، وحجم الشركة، والمسميات الوظيفية، والاستبعادات، أو جمهور مشابه لأفضل عملائك" },
  reach: { en: "Named companies and their decision makers, each contacted directly with a personal email from your own mailbox", ar: "شركات بعينها وصنّاع القرار فيها، يُتواصل مع كل منهم مباشرة برسالة شخصية من بريدك أنت" },
  pay: { en: "The people Yolias finds and reaches for your campaigns; emails, replies and meetings aren't charged", ar: "الأشخاص الذين يجدهم يولياس ويتواصل معهم لحملاتك؛ والرسائل والردود والاجتماعات بلا رسوم" },
  after: { en: "Its AI Sales Agent answers questions and objections, follows up and books the meeting on your calendar", ar: "يجيب وكيل المبيعات الذكي عن الأسئلة والاعتراضات، ويتابع، ويحجز الاجتماع في تقويمك" },
  results: { en: "Meetings, website purchases and leads (with the Yolias pixel), revenue and cost per result, per campaign and audience", ar: "الاجتماعات، والمشتريات والعملاء من موقعك (ببيكسل يولياس)، والإيرادات وتكلفة النتيجة، لكل حملة وجمهور" },
  fit: { en: "customer acquisition: reaching specific companies and the people who decide there", ar: "اكتساب العملاء: الوصول إلى شركات محددة وإلى من يملك القرار فيها" },
};

const yoliasLimits: LL = {
  en: [
    "Yolias doesn't show ads in feeds, search results or videos, and doesn't build brand awareness at scale.",
    "Its channel today is email from your own mailbox; LinkedIn and other channels are coming.",
    "It is built for selling to businesses; it isn't a way to reach millions of consumers.",
  ],
  ar: [
    "يولياس لا يعرض إعلانات في الصفحات أو نتائج البحث أو الفيديوهات، ولا يبني الانتشار الواسع للعلامة التجارية.",
    "قناته اليوم البريد الإلكتروني من بريدك أنت، وLinkedIn وقنوات أخرى قادمة.",
    "صُمم للبيع للشركات، وليس وسيلة للوصول إلى ملايين المستهلكين.",
  ],
};

const CTA = {
  en: { title: "Add a channel that starts from the customer.", body: "Keep your ads for reach. Define the companies and decision makers you want, and Yolias contacts them, answers and brings back meetings, leads and sales.", label: "Try Yolias" },
  ar: { title: "أضف قناة تبدأ من العميل.", body: "أبقِ إعلاناتك للانتشار. وحدد الشركات وصنّاع القرار الذين تريدهم، فيتواصل معهم يولياس ويرد ويأتيك باجتماعات وعملاء ومبيعات.", label: "جرّب يولياس" },
};

const links = [
  { path: "/compare/ai-advertising-platforms", en: "Advertising platforms compared", ar: "مقارنة منصات الإعلانات" },
  { path: "/product", en: "How Yolias works", ar: "كيف يعمل يولياس" },
  { path: "/pricing", en: "Yolias pricing", ar: "أسعار يولياس" },
];

const platforms: Platform[] = [
  {
    slug: "facebook-ads", name: "Facebook Ads", nameAr: "إعلانات فيسبوك", website: "https://www.facebook.com/business/ads", pricing_url: "https://www.facebook.com/business/ads/pricing",
    keyword: "facebook ads alternative", secondary: ["yolias vs facebook ads", "meta ads alternative", "facebook ads for b2b", "بديل إعلانات فيسبوك", "إعلانات فيسبوك للشركات"],
    summary: { en: "Meta's advertising platform: ads on Facebook, Instagram, Messenger and the Audience Network, bought in an auction and managed in Ads Manager.", ar: "منصة إعلانات Meta: إعلانات على فيسبوك وإنستغرام وماسنجر وشبكة الجمهور، تُشترى بمزاد وتُدار من مدير الإعلانات." },
    best_for: { en: "Reaching large consumer audiences with visual ads, and retargeting people who visited your site.", ar: "الوصول إلى جماهير كبيرة من المستهلكين بإعلانات مرئية، وإعادة استهداف من زاروا موقعك." },
    strengths: { en: ["Very large reach across Meta's apps", "Objectives from awareness to sales, with Lead Ads forms", "The Meta Pixel and Conversions API for measurement", "Custom and lookalike audiences"], ar: ["وصول واسع جدًا عبر تطبيقات Meta", "أهداف من الوعي حتى المبيعات، مع نماذج إعلانات العملاء", "بيكسل Meta وواجهة التحويلات للقياس", "جماهير مخصصة ومشابهة"] },
    limits: { en: ["You pay for impressions or clicks in an auction, whether or not the right buyer sees the ad", "Targeting is by interests and behaviour, not by named companies and job titles"], ar: ["تدفع مقابل الظهور أو النقرات في مزاد، سواء رأى الإعلانَ المشتري المناسب أم لا", "الاستهداف بالاهتمامات والسلوك، لا بشركات محددة ومسميات وظيفية"] },
    them: {
      starts: { en: "An audience by location, age, interests and behaviour, a custom audience or a lookalike", ar: "جمهور حسب الموقع والعمر والاهتمامات والسلوك، أو جمهور مخصص أو مشابه" },
      reach: { en: "People scrolling Facebook, Instagram and Messenger who match the audience", ar: "من يتصفحون فيسبوك وإنستغرام وماسنجر ويطابقون الجمهور" },
      pay: { en: "Impressions or clicks, priced in an auction", ar: "الظهور أو النقرات، بسعر يحدده المزاد" },
      after: { en: "A click to your site, a Lead Ads form or a message; the follow-up is yours", ar: "نقرة إلى موقعك، أو نموذج عميل، أو رسالة؛ والمتابعة عليك" },
      results: { en: "Reach, clicks, leads, purchases and ROAS with the Meta Pixel and Conversions API", ar: "الوصول والنقرات والعملاء والمشتريات والعائد على الإنفاق ببيكسل Meta وواجهة التحويلات" },
      fit: { en: "Awareness and demand from large consumer audiences", ar: "الوعي وخلق الطلب لدى جماهير المستهلكين الكبيرة" },
    },
    lead: { en: "Facebook Ads shows your ad to an audience and charges for the views and clicks. Yolias starts from the customer you want and contacts them directly. They solve different problems, and many businesses use both.", ar: "إعلانات فيسبوك تعرض إعلانك على جمهور وتحاسبك على المشاهدات والنقرات. أما يولياس فيبدأ من العميل الذي تريده ويتواصل معه مباشرة. يحلان مشكلتين مختلفتين، وكثير من الشركات تستخدم الاثنين." },
    answer: { en: "Choose Facebook Ads to reach large consumer audiences and build demand with visual ads. Choose Yolias when you sell to businesses and want to reach specific companies and their decision makers directly, with an AI Sales Agent that carries the conversation to a meeting, a lead or a sale.", ar: "اختر إعلانات فيسبوك للوصول إلى جماهير كبيرة من المستهلكين وخلق الطلب بإعلانات مرئية. واختر يولياس عندما تبيع للشركات وتريد الوصول إلى شركات بعينها وصنّاع القرار فيها مباشرة، مع وكيل مبيعات ذكي يكمل المحادثة حتى اجتماع أو عميل أو بيع." },
    chooseThem: { en: ["You sell to consumers and need reach and frequency.", "Visual creative (images, video, Reels) is how your product sells.", "You want to retarget visitors of your website."], ar: ["تبيع للمستهلكين وتحتاج الوصول والتكرار.", "منتجك يُباع بالمحتوى المرئي (صور وفيديو وريلز).", "تريد إعادة استهداف زوار موقعك."] },
    together: { en: "Run Facebook Ads for awareness and retargeting, and Yolias to reach the companies and decision makers who will never click an ad. The Yolias pixel counts the purchases and leads its campaigns bring, so you see each channel's results side by side.", ar: "شغّل إعلانات فيسبوك للوعي وإعادة الاستهداف، ويولياس للوصول إلى الشركات وصنّاع القرار الذين لن ينقروا على إعلان أبدًا. ويحسب بيكسل يولياس المشتريات والعملاء الذين تأتي بهم حملاته، فترى نتائج كل قناة جنبًا إلى جنب." },
    faq: {
      en: [
        { q: "Is Yolias an alternative to Facebook Ads?", a: "For customer acquisition, yes: instead of showing an ad and paying for views, Yolias reaches the companies and decision makers you define and contacts each one directly. For consumer reach and awareness, Facebook Ads does a job Yolias doesn't." },
        { q: "Why do Facebook Ads often struggle to reach specific buyers?", a: "Facebook targets people by interests and behaviour, not by company and job title, so an ad is shown to many people who can't buy. Yolias targets named companies and roles." },
        { q: "Does Yolias have a pixel like the Meta Pixel?", a: "Yes. The Yolias pixel counts page views, purchases and leads on your website and credits them to the campaign that brought each person, within a 7-day attribution window by default." },
      ],
      ar: [
        { q: "هل يولياس بديل لإعلانات فيسبوك؟", a: "لاكتساب العملاء نعم: بدل أن تعرض إعلانًا وتدفع مقابل المشاهدات، يصل يولياس إلى الشركات وصنّاع القرار الذين تحددهم ويتواصل مع كل منهم مباشرة. أما الانتشار لدى المستهلكين والوعي بالعلامة فإعلانات فيسبوك تؤدي دورًا لا يؤديه يولياس." },
        { q: "لماذا لا تصل إعلانات فيسبوك غالبًا إلى المشتري المحدد؟", a: "يستهدف فيسبوك الناس حسب الاهتمامات والسلوك، لا حسب الشركة والمسمى الوظيفي، فيظهر إعلان الشركات لكثيرين لا يملكون قرار الشراء. أما يولياس فيستهدف شركات ومناصب بعينها." },
        { q: "هل لدى يولياس بيكسل مثل بيكسل Meta؟", a: "نعم. بيكسل يولياس يحسب مشاهدات الصفحات والمشتريات والعملاء على موقعك وينسبها للحملة التي جاءت بكل شخص، خلال نافذة احتساب 7 أيام افتراضيًا." },
      ],
    },
    sources: ["https://www.facebook.com/business/ads", "https://www.facebook.com/business/ads/pricing", "https://www.facebook.com/business/tools/meta-pixel"],
  },
  {
    slug: "google-ads", name: "Google Ads", nameAr: "إعلانات جوجل", website: "https://ads.google.com", pricing_url: "https://ads.google.com/home/pricing/",
    keyword: "google ads alternative", secondary: ["yolias vs google ads", "google ads for b2b", "بديل إعلانات جوجل", "إعلانات جوجل للشركات"],
    summary: { en: "Google's advertising platform: search, display, YouTube, Shopping and Performance Max campaigns, bought in an auction.", ar: "منصة إعلانات جوجل: حملات البحث والشبكة الإعلانية ويوتيوب والتسوق وPerformance Max، تُشترى بمزاد." },
    best_for: { en: "Capturing people who are already searching for what you sell.", ar: "التقاط من يبحثون بالفعل عما تبيعه." },
    strengths: { en: ["Reaches people at the moment they search", "Search, YouTube, display and Shopping in one account", "Conversion tracking and smart bidding", "Pay per click on search ads"], ar: ["يصل إلى الناس لحظة بحثهم", "البحث ويوتيوب والشبكة الإعلانية والتسوق في حساب واحد", "تتبع التحويلات والمزايدة الذكية", "الدفع لكل نقرة في إعلانات البحث"] },
    limits: { en: ["Works only when people already search for your service; it doesn't create demand at a named company", "Clicks on competitive keywords are priced by auction and can be expensive"], ar: ["يعمل فقط عندما يبحث الناس بالفعل عن خدمتك، ولا يخلق الطلب لدى شركة بعينها", "النقرات على الكلمات التنافسية بسعر المزاد وقد تكون مكلفة"] },
    them: {
      starts: { en: "Keywords people search for, plus audiences and placements", ar: "كلمات يبحث عنها الناس، مع جماهير ومواضع عرض" },
      reach: { en: "People searching on Google, watching YouTube or browsing partner sites", ar: "من يبحثون في جوجل أو يشاهدون يوتيوب أو يتصفحون المواقع الشريكة" },
      pay: { en: "Mostly clicks (search) or impressions and views, priced in an auction", ar: "غالبًا النقرات (البحث) أو الظهور والمشاهدات، بسعر يحدده المزاد" },
      after: { en: "A visit to your site or a call; turning it into a customer is yours", ar: "زيارة لموقعك أو اتصال؛ وتحويلها إلى عميل عليك" },
      results: { en: "Clicks, conversions, conversion value and ROAS with Google tag and conversion tracking", ar: "النقرات والتحويلات وقيمتها والعائد على الإنفاق بوسم جوجل وتتبع التحويلات" },
      fit: { en: "Capturing existing demand from searches", ar: "التقاط الطلب الموجود من عمليات البحث" },
    },
    lead: { en: "Google Ads waits for people to search, then shows your ad. Yolias goes to the companies that fit your offer, whether or not they are searching today.", ar: "إعلانات جوجل تنتظر أن يبحث الناس ثم تعرض إعلانك. أما يولياس فيذهب إلى الشركات التي تناسب عرضك، سواء كانت تبحث اليوم أم لا." },
    answer: { en: "Choose Google Ads to capture people already searching for your service. Choose Yolias to reach the companies and decision makers who fit your offer but aren't searching, and to have an AI Sales Agent turn the conversation into a meeting, a lead or a sale.", ar: "اختر إعلانات جوجل لالتقاط من يبحثون بالفعل عن خدمتك. واختر يولياس للوصول إلى الشركات وصنّاع القرار الذين يناسبهم عرضك لكنهم لا يبحثون، وليحوّل وكيل المبيعات الذكي المحادثة إلى اجتماع أو عميل أو بيع." },
    chooseThem: { en: ["People already search for your service by name.", "You sell products that fit Shopping ads.", "You want video reach on YouTube."], ar: ["الناس يبحثون بالفعل عن خدمتك بالاسم.", "تبيع منتجات تناسب إعلانات التسوق.", "تريد الوصول بالفيديو على يوتيوب."] },
    together: { en: "Search ads catch the buyers who come looking; Yolias reaches the ones who never search. Together they cover both halves of the market.", ar: "إعلانات البحث تلتقط المشترين الذين يبحثون، ويولياس يصل إلى من لا يبحثون أبدًا. ومعًا يغطيان نصفي السوق." },
    faq: {
      en: [
        { q: "Is Yolias an alternative to Google Ads?", a: "It is a different channel. Google Ads captures existing search demand; Yolias creates conversations with companies that fit your offer. Businesses often use Yolias when search volume for their service is small or clicks are expensive." },
        { q: "Do I pay per click with Yolias?", a: "No. You pay for the people Yolias finds and reaches for your campaigns; emails, replies and meetings aren't charged." },
      ],
      ar: [
        { q: "هل يولياس بديل لإعلانات جوجل؟", a: "هو قناة مختلفة. إعلانات جوجل تلتقط الطلب الموجود في البحث، ويولياس يفتح محادثات مع شركات يناسبها عرضك. وكثيرًا ما تستخدم الشركات يولياس عندما يكون البحث عن خدمتها قليلًا أو تكون النقرات مكلفة." },
        { q: "هل أدفع لكل نقرة مع يولياس؟", a: "لا. تدفع مقابل الأشخاص الذين يجدهم يولياس ويتواصل معهم لحملاتك، والرسائل والردود والاجتماعات بلا رسوم." },
      ],
    },
    sources: ["https://ads.google.com", "https://ads.google.com/home/pricing/", "https://support.google.com/google-ads/answer/1722022"],
  },
  {
    slug: "tiktok-ads", name: "TikTok Ads", nameAr: "إعلانات تيك توك", website: "https://ads.tiktok.com", pricing_url: "https://ads.tiktok.com/help/article/bidding-strategies",
    keyword: "tiktok ads alternative", secondary: ["yolias vs tiktok ads", "tiktok ads for b2b", "بديل إعلانات تيك توك", "إعلانات تيك توك للشركات"],
    summary: { en: "TikTok's advertising platform: short video ads in the For You feed, bought in an auction and managed in TikTok Ads Manager.", ar: "منصة إعلانات تيك توك: إعلانات فيديو قصيرة في صفحة «لك»، تُشترى بمزاد وتُدار من مدير إعلانات تيك توك." },
    best_for: { en: "Reaching young consumer audiences with short videos.", ar: "الوصول إلى جماهير المستهلكين الشباب بفيديوهات قصيرة." },
    strengths: { en: ["Large, highly engaged audience", "Video formats native to the feed", "TikTok Pixel and Events API", "Lead generation and sales objectives"], ar: ["جمهور كبير وشديد التفاعل", "صيغ فيديو أصيلة في الصفحة", "بيكسل تيك توك وواجهة الأحداث", "أهداف لجذب العملاء والمبيعات"] },
    limits: { en: ["Needs a steady flow of video creative", "Targeting by interests and behaviour, not by company or job title"], ar: ["يحتاج إلى فيديوهات جديدة باستمرار", "الاستهداف بالاهتمامات والسلوك، لا بالشركة أو المسمى الوظيفي"] },
    them: {
      starts: { en: "An audience by location, age, interests and behaviour, or a custom or lookalike audience", ar: "جمهور حسب الموقع والعمر والاهتمامات والسلوك، أو جمهور مخصص أو مشابه" },
      reach: { en: "People watching videos in the For You feed", ar: "من يشاهدون الفيديوهات في صفحة «لك»" },
      pay: { en: "Impressions, views or clicks, priced in an auction", ar: "الظهور أو المشاهدات أو النقرات، بسعر يحدده المزاد" },
      after: { en: "A click, an instant form or a message; the follow-up is yours", ar: "نقرة أو نموذج فوري أو رسالة؛ والمتابعة عليك" },
      results: { en: "Views, clicks, leads and purchases with the TikTok Pixel and Events API", ar: "المشاهدات والنقرات والعملاء والمشتريات ببيكسل تيك توك وواجهة الأحداث" },
      fit: { en: "Consumer reach and demand through video", ar: "الانتشار وخلق الطلب لدى المستهلكين بالفيديو" },
    },
    lead: { en: "TikTok Ads puts short videos in front of a huge consumer audience. Yolias is built for the opposite case: a small number of companies and decision makers you want to reach directly.", ar: "إعلانات تيك توك تضع فيديوهات قصيرة أمام جمهور ضخم من المستهلكين. أما يولياس فصُمم للحالة المعاكسة: عدد محدود من الشركات وصنّاع القرار تريد الوصول إليهم مباشرة." },
    answer: { en: "Choose TikTok Ads for consumer reach with video. Choose Yolias when your buyers are businesses and you want to reach the people who decide there, with personal messages and an AI Sales Agent that books the meeting.", ar: "اختر إعلانات تيك توك للانتشار لدى المستهلكين بالفيديو. واختر يولياس عندما يكون مشتروك شركات وتريد الوصول إلى من يملك القرار فيها، برسائل شخصية ووكيل مبيعات ذكي يحجز الاجتماع." },
    chooseThem: { en: ["Your customers are consumers, especially younger ones.", "You can produce short videos every week.", "You want awareness for a new product."], ar: ["عملاؤك مستهلكون، خاصة الشباب.", "تستطيع إنتاج فيديوهات قصيرة كل أسبوع.", "تريد الوعي بمنتج جديد."] },
    together: { en: "TikTok builds your brand with consumers; Yolias brings in the business customers, partners and distributors that a feed won't reach.", ar: "تيك توك يبني علامتك لدى المستهلكين، ويولياس يأتيك بالعملاء من الشركات والشركاء والموزعين الذين لن تصلهم الصفحة." },
    faq: {
      en: [{ q: "Can TikTok Ads bring customers directly?", a: "Sometimes, for awareness. But TikTok can't target a company or a job title, so most of the spend reaches people who can't buy. Yolias reaches named companies and roles directly." }],
      ar: [{ q: "هل تجلب إعلانات تيك توك عملاء مباشرة؟", a: "أحيانًا للوعي. لكن تيك توك لا يستهدف شركة أو مسمى وظيفيًا، فيذهب معظم الإنفاق إلى من لا يملكون قرار الشراء. أما يولياس فيصل إلى شركات ومناصب بعينها مباشرة." }],
    },
    sources: ["https://ads.tiktok.com", "https://ads.tiktok.com/help/article/bidding-strategies", "https://ads.tiktok.com/help/article/tiktok-pixel"],
  },
  {
    slug: "snapchat-ads", name: "Snapchat Ads", nameAr: "إعلانات سناب شات", website: "https://forbusiness.snapchat.com", pricing_url: "https://forbusiness.snapchat.com/advertising",
    keyword: "snapchat ads alternative", secondary: ["yolias vs snapchat ads", "بديل إعلانات سناب شات", "إعلانات سناب شات للشركات"],
    summary: { en: "Snap's advertising platform: full-screen ads between Stories, in Discover and Spotlight, and AR lenses, bought in an auction.", ar: "منصة إعلانات Snap: إعلانات بملء الشاشة بين القصص وفي «اكتشف» و«الأضواء»، وعدسات الواقع المعزز، تُشترى بمزاد." },
    best_for: { en: "Reaching young consumers, a strong channel in Saudi Arabia and the Gulf.", ar: "الوصول إلى المستهلكين الشباب، وهي قناة قوية في السعودية والخليج." },
    strengths: { en: ["Strong reach in the Gulf", "Full-screen vertical formats and AR lenses", "Snap Pixel and Conversions API", "Custom and lookalike audiences"], ar: ["وصول قوي في الخليج", "صيغ عمودية بملء الشاشة وعدسات الواقع المعزز", "بيكسل Snap وواجهة التحويلات", "جماهير مخصصة ومشابهة"] },
    limits: { en: ["Built for consumer audiences", "Targeting by demographics and interests, not by company or job title"], ar: ["مصمم لجماهير المستهلكين", "الاستهداف بالخصائص الديموغرافية والاهتمامات، لا بالشركة أو المسمى الوظيفي"] },
    them: {
      starts: { en: "An audience by location, age, interests and lifestyle, or a custom or lookalike audience", ar: "جمهور حسب الموقع والعمر والاهتمامات ونمط الحياة، أو جمهور مخصص أو مشابه" },
      reach: { en: "People watching Stories, Discover and Spotlight", ar: "من يشاهدون القصص و«اكتشف» و«الأضواء»" },
      pay: { en: "Impressions, swipes or actions, priced in an auction", ar: "الظهور أو السحب أو الإجراءات، بسعر يحدده المزاد" },
      after: { en: "A swipe to your site or a lead form; the follow-up is yours", ar: "سحب إلى موقعك أو نموذج عميل؛ والمتابعة عليك" },
      results: { en: "Swipes, leads and purchases with the Snap Pixel and Conversions API", ar: "السحب والعملاء والمشتريات ببيكسل Snap وواجهة التحويلات" },
      fit: { en: "Consumer reach, especially in the Gulf", ar: "الانتشار لدى المستهلكين، خاصة في الخليج" },
    },
    lead: { en: "Snapchat Ads is one of the strongest ways to reach young consumers in Saudi Arabia and the Gulf. When your buyers are companies, Yolias reaches the decision makers directly instead.", ar: "إعلانات سناب شات من أقوى طرق الوصول إلى المستهلكين الشباب في السعودية والخليج. وعندما يكون مشتروك شركات، يصل يولياس إلى صنّاع القرار مباشرة بدلًا من ذلك." },
    answer: { en: "Choose Snapchat Ads for consumer reach in the Gulf. Choose Yolias to reach Gulf companies and their decision makers by name, in Arabic or English, with an AI Sales Agent that answers and books the meeting.", ar: "اختر إعلانات سناب شات للانتشار لدى المستهلكين في الخليج. واختر يولياس للوصول إلى شركات الخليج وصنّاع القرار فيها بالاسم، بالعربية أو الإنجليزية، مع وكيل مبيعات ذكي يرد ويحجز الاجتماع." },
    chooseThem: { en: ["You sell to consumers in Saudi Arabia, the UAE or Kuwait.", "Your audience is under 35.", "AR lenses or vertical video suit your product."], ar: ["تبيع للمستهلكين في السعودية أو الإمارات أو الكويت.", "جمهورك تحت 35 عامًا.", "عدسات الواقع المعزز أو الفيديو العمودي تناسب منتجك."] },
    together: { en: "Use Snapchat for consumer demand and Yolias for the companies you sell to, the partners and the distributors.", ar: "استخدم سناب شات للطلب لدى المستهلكين، ويولياس للشركات التي تبيع لها وللشركاء والموزعين." },
    faq: {
      en: [{ q: "Is Snapchat good for reaching decision makers in Saudi Arabia?", a: "Snapchat reaches a large share of people in Saudi Arabia, but it can't target a company or a job title. To reach decision makers at Saudi companies directly, Yolias finds them and contacts each one." }],
      ar: [{ q: "هل سناب شات مناسب للوصول إلى صناع القرار في السعودية؟", a: "يصل سناب شات إلى نسبة كبيرة من الناس في السعودية، لكنه لا يستهدف شركة أو مسمى وظيفيًا. وللوصول إلى صنّاع القرار في الشركات السعودية مباشرة، يجدهم يولياس ويتواصل مع كل منهم." }],
    },
    sources: ["https://forbusiness.snapchat.com", "https://forbusiness.snapchat.com/advertising", "https://businesshelp.snapchat.com/s/article/snap-pixel-about"],
  },
  {
    slug: "linkedin-ads", name: "LinkedIn Ads", nameAr: "إعلانات لينكدإن", website: "https://business.linkedin.com/marketing-solutions/ads", pricing_url: "https://business.linkedin.com/marketing-solutions/ads/pricing",
    keyword: "linkedin ads alternative", secondary: ["yolias vs linkedin ads", "linkedin ads cost", "بديل إعلانات لينكدإن", "إعلانات لينكدإن"],
    summary: { en: "LinkedIn's advertising platform: sponsored posts, messages and lead gen forms targeted by company, job title and industry, bought in an auction.", ar: "منصة إعلانات LinkedIn: منشورات ورسائل ممولة ونماذج لجذب العملاء تُستهدف حسب الشركة والمسمى الوظيفي والمجال، وتُشترى بمزاد." },
    best_for: { en: "Awareness and lead forms targeted by company and job title.", ar: "الوعي لدى الشركات ونماذج العملاء المستهدفة حسب الشركة والمسمى الوظيفي." },
    strengths: { en: ["Targeting by company, job title, seniority and industry", "Lead Gen Forms prefilled from the profile", "Insight Tag for conversions", "Matched audiences from company lists"], ar: ["استهداف حسب الشركة والمسمى الوظيفي والأقدمية والمجال", "نماذج جذب العملاء معبأة من الملف الشخصي", "وسم Insight لقياس التحويلات", "جماهير مطابقة من قوائم الشركات"] },
    limits: { en: ["Clicks and impressions on LinkedIn are priced by auction and are usually among the most expensive", "An ad in the feed; the conversation after the form is yours"], ar: ["النقرات والظهور على LinkedIn بسعر المزاد وهي عادة من الأغلى", "إعلان في الصفحة؛ والمحادثة بعد النموذج عليك"] },
    them: {
      starts: { en: "An audience by company, job title, seniority, industry and size, or a matched list", ar: "جمهور حسب الشركة والمسمى الوظيفي والأقدمية والمجال والحجم، أو قائمة مطابقة" },
      reach: { en: "Professionals in their LinkedIn feed and inbox", ar: "المهنيون في صفحتهم وصندوق رسائلهم على LinkedIn" },
      pay: { en: "Clicks, impressions or sends, priced in an auction", ar: "النقرات أو الظهور أو الإرسال، بسعر يحدده المزاد" },
      after: { en: "A Lead Gen Form or a visit; the follow-up is yours", ar: "نموذج عميل أو زيارة؛ والمتابعة عليك" },
      results: { en: "Leads and conversions with the Insight Tag", ar: "العملاء والتحويلات بوسم Insight" },
      fit: { en: "Awareness and lead forms by company and role", ar: "الوعي لدى الشركات ونماذج العملاء حسب الشركة والمنصب" },
    },
    lead: { en: "LinkedIn Ads is the ad platform closest to Yolias: both target by company and job title. The difference is what happens next. LinkedIn shows an ad; Yolias writes to each person and carries the conversation to a meeting.", ar: "إعلانات LinkedIn أقرب منصات الإعلانات إلى يولياس: كلاهما يستهدف حسب الشركة والمسمى الوظيفي. والفرق فيما يحدث بعد ذلك: LinkedIn يعرض إعلانًا، ويولياس يكتب لكل شخص ويكمل المحادثة حتى الاجتماع." },
    answer: { en: "Choose LinkedIn Ads for awareness and lead forms across a large professional audience. Choose Yolias when you want each decision maker contacted personally, the replies answered and the meeting booked, paying for the people reached rather than for clicks.", ar: "اختر إعلانات LinkedIn للوعي لدى الشركات ونماذج العملاء عبر جمهور مهني كبير. واختر يولياس عندما تريد التواصل مع كل صاحب قرار شخصيًا، والرد على الردود، وحجز الاجتماع، مع الدفع مقابل الأشخاص الذين وصلت إليهم لا مقابل النقرات." },
    chooseThem: { en: ["You want your brand seen by a whole industry.", "You have budget for awareness at LinkedIn's prices.", "You want lead forms prefilled from profiles."], ar: ["تريد أن يرى قطاع كامل علامتك.", "لديك ميزانية للوعي بأسعار LinkedIn.", "تريد نماذج معبأة من الملفات الشخصية."] },
    together: { en: "Warm a target account list with LinkedIn Ads, then let Yolias contact the decision makers at those same companies directly.", ar: "سخّن قائمة الشركات المستهدفة بإعلانات LinkedIn، ثم دع يولياس يتواصل مباشرة مع صنّاع القرار في الشركات نفسها." },
    faq: {
      en: [{ q: "Does Yolias send LinkedIn messages?", a: "No. Yolias contacts people by email from your own mailbox." }],
      ar: [{ q: "هل يرسل يولياس رسائل على LinkedIn؟", a: "لا. يتواصل يولياس بالبريد الإلكتروني من بريدك أنت." }],
    },
    sources: ["https://business.linkedin.com/marketing-solutions/ads", "https://business.linkedin.com/marketing-solutions/ads/pricing", "https://business.linkedin.com/marketing-solutions/insight-tag"],
  },
  {
    slug: "x-ads", name: "X Ads", nameAr: "إعلانات إكس", website: "https://ads.x.com", pricing_url: "https://business.x.com/en/advertising",
    keyword: "x ads alternative", secondary: ["twitter ads alternative", "yolias vs x ads", "بديل إعلانات تويتر", "إعلانات إكس"],
    summary: { en: "X's (formerly Twitter) advertising platform: promoted posts and video in the timeline, bought in an auction.", ar: "منصة إعلانات إكس (تويتر سابقًا): منشورات وفيديوهات مروّجة في الخط الزمني، تُشترى بمزاد." },
    best_for: { en: "Joining live conversations and topics with promoted posts.", ar: "المشاركة في المحادثات والموضوعات الحية بمنشورات مروّجة." },
    strengths: { en: ["Targeting by keywords, topics and followers of accounts", "Real-time conversations and events", "X Pixel for conversions"], ar: ["استهداف بالكلمات والموضوعات ومتابعي الحسابات", "محادثات وأحداث لحظية", "بيكسل إكس للتحويلات"] },
    limits: { en: ["Targeting by interests and conversations, not by company and job title", "You pay for engagement or clicks in an auction"], ar: ["الاستهداف بالاهتمامات والمحادثات، لا بالشركة والمسمى الوظيفي", "تدفع مقابل التفاعل أو النقرات في مزاد"] },
    them: {
      starts: { en: "Keywords, topics, followers of accounts, location and custom audiences", ar: "كلمات وموضوعات ومتابعو حسابات وموقع وجماهير مخصصة" },
      reach: { en: "People reading their timeline and searches on X", ar: "من يقرؤون خطهم الزمني وعمليات البحث على إكس" },
      pay: { en: "Engagements, clicks or views, priced in an auction", ar: "التفاعل أو النقرات أو المشاهدات، بسعر يحدده المزاد" },
      after: { en: "A click or a reply; the follow-up is yours", ar: "نقرة أو رد؛ والمتابعة عليك" },
      results: { en: "Engagement, clicks and conversions with the X Pixel", ar: "التفاعل والنقرات والتحويلات ببيكسل إكس" },
      fit: { en: "Visibility in live conversations", ar: "الظهور في المحادثات الحية" },
    },
    lead: { en: "X Ads puts your post in front of people following a topic. Yolias puts a personal message in front of the decision maker you chose.", ar: "إعلانات إكس تضع منشورك أمام من يتابعون موضوعًا. أما يولياس فيضع رسالة شخصية أمام صاحب القرار الذي اخترته." },
    answer: { en: "Choose X Ads for visibility in conversations and topics. Choose Yolias to reach specific companies and decision makers directly and turn the conversation into a meeting, a lead or a sale.", ar: "اختر إعلانات إكس للظهور في المحادثات والموضوعات. واختر يولياس للوصول إلى شركات وصنّاع قرار محددين مباشرة وتحويل المحادثة إلى اجتماع أو عميل أو بيع." },
    chooseThem: { en: ["Your market talks about your topic on X every day.", "You want to be seen around events and launches."], ar: ["سوقك يتحدث عن موضوعك على إكس يوميًا.", "تريد الظهور حول الفعاليات والإطلاقات."] },
    together: { en: "Use X to be part of the conversation and Yolias to start one-to-one conversations with the companies you want as customers.", ar: "استخدم إكس لتكون جزءًا من النقاش، ويولياس لبدء محادثات فردية مع الشركات التي تريدها عملاء." },
    faq: {
      en: [{ q: "Is Yolias like promoted posts?", a: "No. Promoted posts are public ads shown to an audience. Yolias sends a personal email to each decision maker it finds, and answers their replies." }],
      ar: [{ q: "هل يولياس مثل المنشورات المروّجة؟", a: "لا. المنشورات المروّجة إعلانات عامة تُعرض على جمهور. أما يولياس فيرسل رسالة شخصية لكل صاحب قرار يجده، ويرد على ردوده." }],
    },
    sources: ["https://ads.x.com", "https://business.x.com/en/advertising"],
  },
];

export const adCompetitors: SeedCompetitor[] = platforms.map((p) => ({
  slug: p.slug, name: p.name, website: p.website, pricing_url: p.pricing_url, publishes_prices: null,
  summary: p.summary, best_for: p.best_for, strengths: p.strengths, limits: p.limits,
  // Ad prices are set by auction: none is quoted, the pricing link explains how they work.
  pricing: [],
  facts: [fact("name", p.name, p.nameAr, p.website), fact("pricing_model", "Auction: you set a budget and a bid strategy; the price of each impression or click varies", "مزاد: تحدد ميزانية واستراتيجية مزايدة، ويتغير سعر كل ظهور أو نقرة", p.pricing_url)],
}));

function versus(p: Platform): SeedPage {
  const side = (l: "en" | "ar") => ({
    title: l === "en" ? `Yolias vs ${p.name}` : `يولياس مقابل ${p.nameAr}`,
    h1: l === "en" ? `Yolias vs ${p.name}: reach an audience, or reach the customer?` : `يولياس أم ${p.nameAr}: تصل إلى جمهور، أم إلى العميل نفسه؟`,
    metaTitle: l === "en" ? `${p.name} alternative for customer acquisition: Yolias vs ${p.name}` : `بديل ${p.nameAr} لاكتساب العملاء: يولياس مقابل ${p.nameAr}`,
    metaDescription: l === "en"
      ? `${p.name} or Yolias? How an ad platform and an AI advertising platform for customer acquisition differ in targeting, cost, follow-up and results.`
      : `${p.nameAr} أم يولياس؟ الفرق بين منصة إعلانات ومنصة إعلانات بالذكاء الاصطناعي لاكتساب العملاء في الاستهداف والتكلفة والمتابعة والنتائج.`,
    lead: p.lead[l],
    answer: p.answer[l],
    compare: rows.map((r) => ({ label: labels[r][l], yolias: Y[r][l], them: p.them[r][l] })),
    blocks: [
      { h2: l === "en" ? `When ${p.name} is the better choice` : `متى تكون ${p.nameAr} الخيار الأفضل` },
      { ul: p.chooseThem[l] },
      { h2: l === "en" ? "When Yolias is the better choice" : "متى يكون يولياس الخيار الأفضل" },
      { ul: l === "en"
        ? ["You sell to businesses and know which companies and job titles you want.", "You want each decision maker contacted personally, not shown an ad.", "You want the follow-up done for you: answers, objections and the meeting booked.", "You want to pay for the people reached, not for views or clicks."]
        : ["تبيع للشركات وتعرف الشركات والمسميات الوظيفية التي تريدها.", "تريد التواصل مع كل صاحب قرار شخصيًا، لا عرض إعلان عليه.", "تريد أن تتم المتابعة عنك: الإجابات والاعتراضات وحجز الاجتماع.", "تريد الدفع مقابل الأشخاص الذين وصلت إليهم، لا مقابل المشاهدات أو النقرات."] },
      { h2: l === "en" ? "Using both" : "استخدام الاثنين معًا" },
      { p: p.together[l] },
      { h2: l === "en" ? "What Yolias doesn't do" : "ما الذي لا يفعله يولياس" },
      { ul: yoliasLimits[l] },
    ],
    faq: p.faq[l],
    cta: CTA[l],
  });
  return {
    kind: "compare", slug: p.slug, format: "versus", competitor: p.slug, tools: [p.slug],
    primary_keyword: p.keyword, secondary_keywords: p.secondary,
    links, sources: p.sources,
    en: side("en"), ar: side("ar"),
  };
}

const hub: SeedPage = {
  kind: "compare", slug: "ai-advertising-platforms", format: "list",
  tools: platforms.map((p) => p.slug),
  primary_keyword: "ai advertising platform", secondary_keywords: ["best advertising platforms for b2b", "customer acquisition platform", "alternatives to facebook and google ads", "منصة إعلانات بالذكاء الاصطناعي", "أفضل منصات الإعلانات للشركات", "منصات اكتساب العملاء"],
  links: [{ path: "/product", en: "How Yolias works", ar: "كيف يعمل يولياس" }, { path: "/pricing", en: "Yolias pricing", ar: "أسعار يولياس" }],
  sources: platforms.map((p) => p.website),
  en: {
    title: "Advertising platforms compared",
    h1: "Advertising platforms for customer acquisition, compared",
    metaTitle: "AI Advertising Platform vs Facebook, Google & TikTok Ads",
    metaDescription: "Facebook, Google, TikTok, Snapchat, LinkedIn and X ads compared with Yolias, the AI advertising platform that reaches the customers you choose.",
    lead: "Every ad platform sells attention: an audience sees your ad, and you pay for the views or clicks. Yolias is an AI advertising platform built the other way round: you choose the customer, and the AI goes to them.",
    answer: "For consumer reach and awareness, Facebook, Instagram, TikTok and Snapchat ads are hard to beat; for people already searching, Google Ads; for awareness by job title, LinkedIn Ads. When you sell to businesses and want specific companies and decision makers contacted directly, with the follow-up done for you and results counted, Yolias adds the channel the others don't cover.",
    criteria: [
      "**Who you sell to:** consumers at scale, or a defined list of companies and roles.",
      "**Demand:** do buyers already search for you, or do you need to start the conversation?",
      "**What you pay for:** impressions and clicks in an auction, or the people reached.",
      "**After the click:** who answers, follows up and books the meeting.",
      "**Measurement:** a pixel for purchases and leads, and revenue per campaign.",
    ],
    blocks: [
      { h2: "Which platform for which job" },
      { table: { head: ["Platform", "Best at", "You pay for"], rows: [
        ["Facebook & Instagram Ads", "Consumer reach and retargeting", "Impressions or clicks (auction)"],
        ["Google Ads", "Capturing search demand", "Clicks, impressions or views (auction)"],
        ["TikTok Ads", "Consumer reach with short video", "Impressions, views or clicks (auction)"],
        ["Snapchat Ads", "Young consumers, strong in the Gulf", "Impressions, swipes or actions (auction)"],
        ["LinkedIn Ads", "Awareness by company and job title", "Clicks, impressions or sends (auction)"],
        ["X Ads", "Visibility in live conversations", "Engagements, clicks or views (auction)"],
        ["Yolias", "Reaching named companies and decision makers directly, with an AI Sales Agent", "The people found and reached"],
      ] } },
      { h2: "Where Yolias fits" },
      { p: "Yolias combines lead discovery, an AI Sales Agent and meetings in one platform. Each campaign has a goal (meetings, website purchases, website leads or qualified leads), audiences of companies and job titles, and a message; Yolias finds the matching decision makers, contacts each one from your own mailbox, answers and books, and the Yolias pixel counts conversions and revenue. Its channel today is email; it doesn't show ads in feeds." },
    ],
    faq: [
      { q: "What is an AI advertising platform?", a: "A platform where AI runs the campaign for a result you choose. In Yolias, AI finds the customers who match your audiences, writes to each one, answers the replies and books meetings, and optimizes the budget toward the audiences that convert." },
      { q: "Which advertising platform is best for customer acquisition?", a: "For awareness by job title, LinkedIn Ads. For buyers already searching, Google Ads. To reach specific companies and decision makers directly and have the conversation carried to a meeting, Yolias." },
      { q: "Should I stop my ads to use Yolias?", a: "No. Yolias adds an acquisition channel. Keep the ads that work, and use Yolias to reach the customers ads don't." },
    ],
    cta: CTA.en,
  },
  ar: {
    title: "مقارنة منصات الإعلانات",
    h1: "منصات الإعلانات لاكتساب العملاء: مقارنة",
    metaTitle: "منصة إعلانات ذكية مقابل فيسبوك وجوجل وتيك توك وسناب",
    metaDescription: "مقارنة إعلانات فيسبوك وجوجل وتيك توك وسناب شات ولينكدإن وإكس مع يولياس، منصة الإعلانات بالذكاء الاصطناعي التي تصل إلى العملاء الذين تختارهم.",
    lead: "كل منصة إعلانات تبيع الانتباه: جمهور يرى إعلانك، وتدفع مقابل المشاهدات أو النقرات. أما يولياس فمنصة إعلانات بالذكاء الاصطناعي مبنية بالعكس: أنت تختار العميل، والذكاء الاصطناعي يذهب إليه.",
    answer: "للانتشار والوعي لدى المستهلكين يصعب منافسة إعلانات فيسبوك وإنستغرام وتيك توك وسناب شات، ولمن يبحثون بالفعل إعلانات جوجل، وللوعي لدى الشركات حسب المسمى الوظيفي إعلانات لينكدإن. وعندما تبيع للشركات وتريد التواصل مباشرة مع شركات وصنّاع قرار محددين، مع متابعة تتم عنك ونتائج محسوبة، يضيف يولياس القناة التي لا تغطيها المنصات الأخرى.",
    criteria: [
      "**لمن تبيع:** مستهلكون بأعداد كبيرة، أم قائمة محددة من الشركات والمناصب.",
      "**الطلب:** هل يبحث المشترون عنك بالفعل، أم تحتاج أن تبدأ المحادثة؟",
      "**مقابل ماذا تدفع:** الظهور والنقرات في مزاد، أم الأشخاص الذين تصل إليهم.",
      "**بعد النقرة:** من يرد ويتابع ويحجز الاجتماع.",
      "**القياس:** بيكسل للمشتريات والعملاء، والإيرادات لكل حملة.",
    ],
    blocks: [
      { h2: "أي منصة لأي مهمة" },
      { table: { head: ["المنصة", "أفضل ما تقدمه", "تدفع مقابل"], rows: [
        ["إعلانات فيسبوك وإنستغرام", "الانتشار لدى المستهلكين وإعادة الاستهداف", "الظهور أو النقرات (مزاد)"],
        ["إعلانات جوجل", "التقاط الطلب من البحث", "النقرات أو الظهور أو المشاهدات (مزاد)"],
        ["إعلانات تيك توك", "الانتشار لدى المستهلكين بالفيديو القصير", "الظهور أو المشاهدات أو النقرات (مزاد)"],
        ["إعلانات سناب شات", "المستهلكون الشباب، وقوية في الخليج", "الظهور أو السحب أو الإجراءات (مزاد)"],
        ["إعلانات لينكدإن", "الوعي لدى الشركات حسب الشركة والمسمى الوظيفي", "النقرات أو الظهور أو الإرسال (مزاد)"],
        ["إعلانات إكس", "الظهور في المحادثات الحية", "التفاعل أو النقرات أو المشاهدات (مزاد)"],
        ["يولياس", "الوصول المباشر إلى شركات وصنّاع قرار بعينهم، مع وكيل مبيعات ذكي", "الأشخاص الذين يجدهم ويتواصل معهم"],
      ] } },
      { h2: "أين يناسب يولياس" },
      { p: "يجمع يولياس اكتشاف العملاء ووكيل المبيعات الذكي والاجتماعات في منصة واحدة. لكل حملة هدف (اجتماعات، أو مشتريات من موقعك، أو عملاء من موقعك، أو عملاء مؤهلون)، وجماهير من الشركات والمسميات الوظيفية، ورسالة؛ فيجد يولياس صنّاع القرار المطابقين، ويتواصل مع كل منهم من بريدك، ويرد ويحجز، ويحسب بيكسل يولياس التحويلات والإيرادات. وقناته اليوم البريد الإلكتروني، ولا يعرض إعلانات في الصفحات." },
    ],
    faq: [
      { q: "ما هي منصة الإعلانات بالذكاء الاصطناعي؟", a: "منصة يدير فيها الذكاء الاصطناعي الحملة لتحقيق نتيجة تختارها. في يولياس يجد الذكاء الاصطناعي العملاء المطابقين لجماهيرك، ويكتب لكل منهم، ويرد على الردود ويحجز الاجتماعات، ويوجّه الميزانية نحو الجماهير التي تحقق نتائج." },
      { q: "ما أفضل منصة إعلانات لاكتساب العملاء؟", a: "للوعي حسب المسمى الوظيفي إعلانات لينكدإن، ولمن يبحثون بالفعل إعلانات جوجل، وللوصول المباشر إلى شركات وصنّاع قرار محددين مع إكمال المحادثة حتى الاجتماع يولياس." },
      { q: "هل أوقف إعلاناتي لأستخدم يولياس؟", a: "لا. يولياس يضيف قناة لاكتساب العملاء. أبقِ الإعلانات التي تنجح، واستخدم يولياس للوصول إلى العملاء الذين لا تصلهم الإعلانات." },
    ],
    cta: CTA.ar,
  },
};

export const adComparePages: SeedPage[] = [hub, ...platforms.map(versus)];
