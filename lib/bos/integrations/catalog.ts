// Integration Hub catalogue (docs/bos/30 §7, doc 31 Phase 4). Definitions
// only — no secrets. `secret: true` fields are encrypted at rest and never
// sent back to the browser; the UI shows a 4-character hint at most.
// `phase` = the upgrade phase whose features use the connection (the hub can
// store and test credentials before that phase lands).

export type ProviderCategory = "email" | "ai" | "google" | "social" | "ads" | "esign" | "payments" | "maps" | "security";

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
};

export const providers: ProviderDef[] = [
  {
    key: "resend", name: "Resend", category: "email", phase: 4, testable: true,
    description: "إرسال البريد (الإشعارات، الدعوات، رسائل العملاء) مع تتبع التسليم عبر Webhook.",
    fields: [
      { key: "api_key", label: "مفتاح API", secret: true, required: true, placeholder: "re_…" },
      { key: "from", label: "عنوان المرسل", required: true, placeholder: "Taysonsta <no-reply@taysonsta.com>" },
      { key: "reply_to", label: "الرد إلى", placeholder: "support@taysonsta.com" },
      { key: "webhook_secret", label: "سر Webhook (whsec_…)", secret: true, hint: "من إعدادات Webhooks في Resend — للتحقق من توقيع أحداث التسليم" },
    ],
    capabilities: ["email.send", "email.status"],
    webhook: { kind: "svix", secretField: "webhook_secret" },
    docs: "https://resend.com/docs",
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
  {
    key: "yolias_microsoft", name: "Microsoft OAuth — Yolias (Outlook)", category: "email", phase: 0, testable: false,
    description: "يربط به عملاء يولياس بريد Outlook / Microsoft 365: إرسال الحملات بعد موافقتهم وقراءة الردود في المحادثات التي بدأها يولياس فقط. في Microsoft Entra: سجّل تطبيقًا (حسابات أي مؤسسة وحسابات Microsoft الشخصية)، وأضف الصلاحيات المفوّضة Mail.Send و Mail.ReadWrite و User.Read و offline_access، وأضف رابط الرجوع https://<دومين يولياس>/api/integrations/outlook/callback، وأنشئ client secret.",
    fields: [
      { key: "client_id", label: "Application (client) ID", required: true },
      { key: "client_secret", label: "Client secret", secret: true, required: true },
    ],
    capabilities: ["mail.send"],
    docs: "https://learn.microsoft.com/graph/outlook-mail-concept-overview",
    yolias: "ربط Outlook وإرسال حملات التواصل وقراءة الردود.",
  },
  {
    key: "paymob", name: "Paymob", category: "payments", phase: 0, testable: false,
    description: "بوابة الدفع لاشتراكات يولياس وباقات العملاء المحتملين الإضافية (السعر بالدولار، والخصم من البطاقة بالجنيه). في لوحة Paymob ضع رابط الإشعارات https://<دومين يولياس>/api/payments/paymob ورابط العودة https://<دومين يولياس>/api/payments/paymob/return.",
    fields: [
      { key: "mode", label: "الوضع", required: true, options: [{ value: "test", label: "تجريبي (مفاتيح Paymob التجريبية)" }, { value: "live", label: "حقيقي" }] },
      { key: "base_url", label: "رابط Paymob", required: true, placeholder: "https://accept.paymob.com", hint: "حسب منطقة الحساب: مصر https://accept.paymob.com" },
      { key: "public_key", label: "المفتاح العام (Public key)", required: true },
      { key: "secret_key", label: "المفتاح السري (Secret key)", secret: true, required: true },
      { key: "hmac_secret", label: "سر HMAC", secret: true, required: true },
      { key: "integrations_usd", label: "رقم تكامل البطاقة (Integration ID)", required: true, hint: "رقم Integration ID الخاص بالدفع بالبطاقة (بالجنيه) من لوحة Paymob، وافصل بين الأرقام بفواصل إن كانت أكثر من رقم. الأسعار بالدولار، ويحوّلها يولياس إلى الجنيه بسعر اليوم عند الدفع." },
    ],
    capabilities: ["payments.checkout"],
    docs: "https://developers.paymob.com",
    yolias: "الدفع أونلاين للاشتراكات والباقات.",
  },
  {
    key: "polar", name: "Polar", category: "payments", phase: 0, testable: true,
    description: "الدفع والاشتراكات في يولياس لكل الدول ما عدا مصر (مصر على Paymob). Polar هو التاجر المسجّل: صفحة الدفع المستضافة تأخذ البطاقة وتبدأ التجربة المجانية 7 أيام، وتخصم في نهايتها وتجدد تلقائيًا، والعميل يدير بطاقته وفواتيره من بوابة العملاء في Polar. أنشئ Organization Access Token من لوحة Polar ← Settings (بدون تاريخ انتهاء) والصقه هنا واختر البيئة نفسها التي أنشأته فيها. لا تحتاج لإنشاء منتجات: يولياس ينشئ منتجات الخطط الست (شهري وسنوي) بنفسه من أسعار الخطط، ويحدّث السعر في Polar عند تغييره هنا في الأدمن (المشتركون الحاليون يبقون على سعرهم). رابط الـ Webhook وقت النشر: https://www.yolias.com/api/webhook/polar (الأحداث order.paid و customer.state_changed).",
    fields: [
      { key: "server", label: "البيئة", required: true, options: [{ value: "production", label: "حقيقي (production)" }, { value: "sandbox", label: "تجريبي (sandbox)" }] },
      { key: "access_token", label: "Organization Access Token", secret: true, required: true, hint: "يبقى على الخادم فقط" },
      { key: "webhook_secret", label: "سر الـ Webhook", secret: true, hint: "يظهر مرة واحدة عند إنشاء الـ Webhook في Polar" },
    ],
    capabilities: ["payments.checkout", "payments.subscriptions"],
    docs: "https://polar.sh/docs",
    yolias: "الاشتراكات والتجربة المجانية خارج مصر.",
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
