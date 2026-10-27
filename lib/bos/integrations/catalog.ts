// Integration Hub catalogue (docs/bos/30 §7, doc 31 Phase 4). Definitions
// only — no secrets. `secret: true` fields are encrypted at rest and never
// sent back to the browser; the UI shows a 4-character hint at most.
// `phase` = the upgrade phase whose features use the connection (the hub can
// store and test credentials before that phase lands).

export type ProviderCategory = "email" | "ai" | "google" | "social" | "ads" | "esign" | "payments" | "maps" | "security" | "data";

export interface ProviderField {
  key: string;
  label: string;
  secret?: boolean;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
}

export interface ProviderDef {
  key: string;
  name: string;
  category: ProviderCategory;
  description: string;
  fields: ProviderField[];
  capabilities: string[];
  testable: boolean;
  webhook?: { kind: "svix" | "meta_hmac" | "hmac_sha256" | "telegram_secret"; secretField: string };
  phase: number;
  docs?: string;
  /** What Yolias (the customer app) uses this connection for; its default active account is copied to Yolias (D-132). */
  yolias?: string;
}

export const categoryLabels: Record<ProviderCategory, string> = {
  email: "البريد الإلكتروني",
  ai: "الذكاء الاصطناعي",
  google: "Google",
  social: "التواصل الاجتماعي",
  ads: "الإعلانات",
  esign: "التوقيع الإلكتروني",
  payments: "الدفع",
  maps: "الخرائط والموقع",
  security: "الحماية",
  data: "مصادر البيانات",
};

export const providers: ProviderDef[] = [
  // Data sources (D-248): registries and verification for the companies database.
  {
    key: "companies_house", name: "UK Companies House", category: "data", phase: 0, testable: false,
    description: "السجل التجاري البريطاني الرسمي (مجاني). يُستخدم في استيراد البيانات ← المصادر المفتوحة لسحب الشركات النشطة حسب النشاط (SIC) والمدينة.",
    fields: [{ key: "api_key", label: "مفتاح API (REST)", secret: true, required: true, hint: "من developer.company-information.service.gov.uk ← Your applications ← Create an application (Live) ← Create new key (REST)" }],
    capabilities: ["company.search"],
    docs: "https://developer-specs.company-information.service.gov.uk/",
  },
  {
    key: "millionverifier", name: "MillionVerifier", category: "data", phase: 0, testable: false,
    description: "التحقق من صحة البريد الإلكتروني قبل الإرسال (مدفوع بالرصيد).",
    fields: [{ key: "api_key", label: "مفتاح API", secret: true, required: true, hint: "من لوحة MillionVerifier ← API" }],
    capabilities: ["email.verify"],
    docs: "https://developer.millionverifier.com/",
    yolias: "التحقق من بريد العملاء المحتملين قبل تسليمهم (مزود email.verify).",
  },
  {
    key: "resend", name: "Resend", category: "email", phase: 4, testable: true,
    description: "إرسال البريد (الإشعارات، الدعوات، رسائل العملاء) مع تتبع التسليم عبر Webhook.",
    fields: [
      { key: "api_key", label: "مفتاح API", secret: true, required: true, placeholder: "re_…" },
      { key: "from", label: "عنوان المرسل", required: true, placeholder: "Taysonsta <no-reply@taysonsta.com>" },
      { key: "reply_to", label: "الرد إلى", placeholder: "support@taysonsta.com" },
      { key: "webhook_secret", label: "سر Webhook (whsec_…)", secret: true, hint: "من إعدادات Webhooks في Resend — للتحقق من توقيع أحداث التسليم" },
      { key: "yolias_from", label: "عنوان المرسل في يولياس", placeholder: "Yolias <no-reply@yolias.com>", hint: "على نطاق موثّق في Resend. فارغ = عنوان المرسل أعلاه." },
    ],
    capabilities: ["email.send", "email.status"],
    webhook: { kind: "svix", secretField: "webhook_secret" },
    docs: "https://resend.com/docs",
    yolias: "إيميلات يولياس للعملاء: الإيصالات والتنبيهات ورسائل الترحيب والأتمتة.",
  },
  {
    key: "support_email", name: "بريد الدعم الوارد", category: "email", phase: 7, testable: false,
    description: "استقبال رسائل العملاء على بريد الدعم كمحادثات في صندوق الوارد (مثلاً عبر Cloudflare Email Routing + Email Worker يرسل الرسالة موقّعة). الردود تُرسل عبر Resend.",
    fields: [
      { key: "inbound_address", label: "عنوان بريد الدعم", required: true, placeholder: "support@taysonsta.com", hint: "يُضبط كـ Reply-To في ردود الفريق حتى تعود ردود العملاء لنفس المحادثة" },
      { key: "signing_secret", label: "سر التوقيع", secret: true, required: true, hint: "يوقّع به الـ Worker جسم الطلب: X-Signature = base64(HMAC-SHA256(secret, body))" },
    ],
    capabilities: ["support.email.inbound"],
    webhook: { kind: "hmac_sha256", secretField: "signing_secret" },
  },
  {
    key: "openai", name: "OpenAI", category: "ai", phase: 4, testable: true,
    description: "نماذج GPT للكتابة والتلخيص والتصنيف والوكلاء.",
    fields: [
      { key: "api_key", label: "مفتاح API", secret: true, required: true, placeholder: "sk-…" },
      { key: "model", label: "النموذج الافتراضي", required: true, placeholder: "gpt-4.1-mini" },
      { key: "organization", label: "المؤسسة (اختياري)" },
    ],
    capabilities: ["ai.text", "ai.json", "ai.embeddings"],
    docs: "https://platform.openai.com/docs",
    yolias: "Yolias AI والبحث (حسب توزيع النماذج في المنصة ← النماذج اللغوية).",
  },
  {
    key: "gemini", name: "Google Gemini", category: "ai", phase: 4, testable: true,
    description: "نماذج Gemini للنصوص والصور.",
    fields: [
      { key: "api_key", label: "مفتاح API", secret: true, required: true },
      { key: "model", label: "النموذج الافتراضي", required: true, placeholder: "gemini-3.8-flash" },
    ],
    capabilities: ["ai.text", "ai.json", "ai.embeddings"],
    docs: "https://ai.google.dev/gemini-api/docs",
    yolias: "Yolias AI والبحث على الويب (حسب توزيع النماذج في المنصة ← النماذج اللغوية).",
  },
  {
    key: "anthropic", name: "Anthropic Claude", category: "ai", phase: 4, testable: true,
    description: "نماذج Claude للكتابة والتحليل والوكلاء.",
    fields: [
      { key: "api_key", label: "مفتاح API", secret: true, required: true, placeholder: "sk-ant-…" },
      { key: "model", label: "النموذج الافتراضي", required: true, placeholder: "claude-sonnet-5" },
    ],
    capabilities: ["ai.text", "ai.json"],
    docs: "https://docs.anthropic.com",
    yolias: "Yolias AI والتفكير وكتابة الرسائل (حسب توزيع النماذج في المنصة ← النماذج اللغوية).",
  },
  {
    key: "yolias_google", name: "Google OAuth — Yolias (Gmail)", category: "google", phase: 0, testable: true,
    description: "يربط به عملاء يولياس بريد Gmail الخاص بهم: إرسال الحملات بعد موافقتهم وقراءة الردود في المحادثات التي بدأها يولياس فقط. في Google Cloud: فعّل Gmail API، وأضف الصلاحيات gmail.send و gmail.readonly في شاشة الموافقة (تحتاج مراجعة Google قبل الاستخدام العام)، وأضف رابط الرجوع https://<دومين يولياس>/api/integrations/gmail/callback. (الدخول بحساب Google يُضبط في Supabase Auth.)",
    fields: [
      { key: "client_id", label: "OAuth client ID", required: true },
      { key: "client_secret", label: "OAuth client secret", secret: true, required: true },
    ],
    capabilities: ["mail.send"],
    docs: "https://developers.google.com/workspace/gmail/api/guides/sending",
    yolias: "ربط Gmail وإرسال حملات التواصل وقراءة الردود.",
  },
  // Outlook removed by the owner (2026-10-21): Gmail and IMAP only.
  {
    key: "paymob", name: "Paymob", category: "payments", phase: 0, testable: false,
    description: "بوابة الدفع الوحيدة في يولياس (Polar وكاشير اتشالوا): الاشتراكات وباقات الرصيد (السعر بالدولار، والخصم من البطاقة بالجنيه). في لوحة Paymob ضع رابط الإشعارات https://<دومين يولياس>/api/payments/paymob ورابط العودة https://<دومين يولياس>/api/payments/paymob/return. للتجديد التلقائي من البطاقة المحفوظة: اطلب من دعم Paymob تفعيل حفظ البطاقات (Card tokenization) على تكامل البطاقة، وتكامل MOTO للخصم بدون العميل، واكتب رقم تكامل MOTO هنا. من غيره يفضل التجديد فاتورة يدفعها العميل.",
    fields: [
      { key: "mode", label: "الوضع", required: true, options: [{ value: "test", label: "تجريبي (مفاتيح Paymob التجريبية)" }, { value: "live", label: "حقيقي" }] },
      { key: "base_url", label: "رابط Paymob", required: true, placeholder: "https://accept.paymob.com", hint: "حسب منطقة الحساب: مصر https://accept.paymob.com" },
      { key: "public_key", label: "المفتاح العام (Public key)", required: true },
      { key: "secret_key", label: "المفتاح السري (Secret key)", secret: true, required: true },
      { key: "hmac_secret", label: "سر HMAC", secret: true, required: true },
      { key: "integrations_usd", label: "رقم تكامل البطاقة (Integration ID)", required: true, hint: "رقم Integration ID الخاص بالدفع بالبطاقة (بالجنيه) من لوحة Paymob، وافصل بين الأرقام بفواصل إن كانت أكثر من رقم. الأسعار بالدولار، ويحوّلها يولياس إلى الجنيه بسعر اليوم عند الدفع." },
      { key: "moto_integration", label: "رقم تكامل MOTO (التجديد التلقائي)", hint: "اختياري: رقم Integration ID من نوع MOTO اللي يفعّله دعم Paymob. يولياس يخصم منه التجديد من البطاقة المحفوظة. فارغ = التجديد فاتورة يدفعها العميل." },
    ],
    capabilities: ["payments.checkout"],
    docs: "https://developers.paymob.com",
    yolias: "الدفع أونلاين للاشتراكات والباقات، والتجديد من البطاقة المحفوظة.",
  },
  {
    key: "turnstile", name: "Cloudflare Turnstile", category: "security", phase: 0, testable: false,
    description: "التحقق البشري عند إنشاء حساب في يولياس (بديل CAPTCHA). أنشئ Widget في لوحة Cloudflare ← Turnstile وأضف نطاق yolias.com، ثم انسخ المفتاحين هنا. بدون المفتاحين يعمل التسجيل بدون تحقق بشري ويظهر تنبيه في Sentry.",
    fields: [
      { key: "site_key", label: "مفتاح الموقع (Site key)", required: true, hint: "مفتاح عام يظهر في صفحة التسجيل" },
      { key: "secret_key", label: "المفتاح السري (Secret key)", secret: true, required: true, hint: "يبقى على الخادم فقط للتحقق من الرمز" },
    ],
    capabilities: ["signup.captcha"],
    docs: "https://developers.cloudflare.com/turnstile/",
    yolias: "التحقق البشري عند إنشاء حساب.",
  },
  {
    key: "search_console", name: "Google Search Console و Bing Webmaster", category: "google", phase: 0, testable: false,
    description: "إثبات ملكية www.yolias.com لمحركات البحث، لمتابعة الظهور والنقرات وأخطاء الفهرسة. في Search Console أضف الموقع واختر طريقة «HTML tag» وانسخ قيمة content فقط. بعد الحفظ يظهر الوسم في صفحات الموقع خلال دقيقة، ثم اضغط Verify هناك.",
    fields: [
      { key: "google_verification", label: "رمز Google (google-site-verification)", hint: "قيمة content فقط، بدون الوسم" },
      { key: "bing_verification", label: "رمز Bing (msvalidate.01)", hint: "اختياري" },
    ],
    capabilities: ["seo.verification"],
    docs: "https://search.google.com/search-console",
    yolias: "إثبات ملكية الموقع لمحركات البحث.",
  },
  {
    key: "google_search_data", name: "Google Search Console و GA4 (بيانات SEO)", category: "google", phase: 0, testable: false,
    description: "يجلب أرقام البحث العضوي إلى Yolias Admin ← SEO: النقرات ومرات الظهور ونسبة النقر والترتيب من Search Console، وحالة فهرسة الصفحات، والزيارات العضوية من GA4. أنشئ حساب خدمة (Service account) في Google Cloud وفعّل Search Console API وGoogle Analytics Data API، ثم أنشئ له مفتاح JSON والصقه هنا. أضف بريد حساب الخدمة مستخدمًا في Search Console (صلاحية كاملة أو مقيدة) وفي GA4 (Viewer). الأرقام تتزامن مرة يوميًا، ويمكن التزامن يدويًا من SEO ← التكاملات.",
    fields: [
      { key: "service_account_json", label: "مفتاح حساب الخدمة (JSON)", secret: true, required: true, hint: "محتوى ملف JSON كاملًا كما نزّلته من Google Cloud" },
      { key: "gsc_property", label: "خاصية Search Console", required: true, placeholder: "sc-domain:yolias.com", hint: "sc-domain:yolias.com لخاصية النطاق، أو https://www.yolias.com/ لخاصية الرابط" },
      { key: "ga4_property", label: "رقم خاصية GA4 (Property ID)", placeholder: "123456789", hint: "اختياري: أرقام فقط، من GA4 ← Admin ← Property details. بدونه تظهر أرقام Search Console فقط" },
    ],
    capabilities: ["seo.search_console", "seo.ga4"],
    docs: "https://developers.google.com/webmaster-tools/v1/how-tos/authorizing",
  },
  {
    key: "google_maps", name: "Google Maps Platform", category: "maps", phase: 19, testable: true,
    description: "الخرائط والعناوين (Geocoding) — للمواقع المصرّح بها فقط.",
    fields: [{ key: "api_key", label: "مفتاح API", secret: true, required: true, hint: "قيّد المفتاح بنطاق موقعك وبالواجهات المستخدمة فقط" }],
    capabilities: ["maps.geocode", "maps.embed"],
    docs: "https://developers.google.com/maps",
  },
  {
    key: "google_workspace", name: "Google Workspace (OAuth)", category: "google", phase: 5, testable: true,
    description: "التقويم والمستندات عبر OAuth لحساب الشركة. الدخول عبر Google للموظفين يُفعّل من الأمان.",
    fields: [
      { key: "client_id", label: "OAuth client ID", required: true },
      { key: "client_secret", label: "OAuth client secret", secret: true, required: true },
    ],
    capabilities: ["google.calendar", "google.drive"],
    docs: "https://developers.google.com/workspace",
  },
  {
    key: "meta", name: "Meta (Facebook & Instagram)", category: "social", phase: 10, testable: true,
    description: "صفحات فيسبوك وحسابات إنستجرام للأعمال: رسائل Messenger وInstagram Direct في صندوق الوارد (يتطلب مراجعة التطبيق لدى Meta).",
    fields: [
      { key: "app_id", label: "App ID", required: true },
      { key: "app_secret", label: "App secret", secret: true, required: true },
      { key: "access_token", label: "Page / system user token", secret: true, required: true },
      { key: "verify_token", label: "Verify token (للرسائل)", secret: true, hint: "نص تختاره وتضعه في إعدادات Webhook لدى Meta لاستقبال رسائل Messenger وInstagram" },
    ],
    capabilities: ["messaging.inbox"],
    webhook: { kind: "meta_hmac", secretField: "app_secret" },
    docs: "https://developers.facebook.com/docs/graph-api",
  },
  {
    key: "telegram", name: "Telegram Bot", category: "social", phase: 10, testable: true,
    description: "رسائل العملاء إلى البوت تصل صندوق الوارد ويُرد عليها من هنا.",
    fields: [
      { key: "bot_token", label: "Bot token (من BotFather)", secret: true, required: true },
      { key: "webhook_secret", label: "Webhook secret", secret: true, hint: "يُولَّد تلقائياً عند تفعيل استقبال الرسائل من صفحة قنوات المراسلة" },
    ],
    capabilities: ["messaging.inbox"],
    webhook: { kind: "telegram_secret", secretField: "webhook_secret" },
    docs: "https://core.telegram.org/bots/api",
  },
];

export const providerMap = new Map(providers.map((p) => [p.key, p]));

export const aiProviders = ["openai", "gemini", "anthropic"] as const;
export type AiProvider = (typeof aiProviders)[number];
