// Integration Hub catalogue (docs/bos/30 §7, doc 31 Phase 4). Definitions
// only — no secrets. `secret: true` fields are encrypted at rest and never
// sent back to the browser; the UI shows a 4-character hint at most.
// `phase` = the upgrade phase whose features use the connection (the hub can
// store and test credentials before that phase lands).

export type ProviderCategory = "email" | "ai" | "google" | "social" | "ads" | "esign" | "payments" | "maps";

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
    description: "يربط به عملاء يولياس بريد Gmail الخاص بهم لإرسال الرسائل بعد موافقتهم. في Google Cloud: فعّل Gmail API، وأضف صلاحية gmail.send، وأضف رابط الرجوع https://<دومين يولياس>/api/integrations/gmail/callback. (الدخول بحساب Google يُضبط في Supabase Auth.)",
    fields: [
      { key: "client_id", label: "OAuth client ID", required: true },
      { key: "client_secret", label: "OAuth client secret", secret: true, required: true },
    ],
    capabilities: ["mail.send"],
    docs: "https://developers.google.com/workspace/gmail/api/guides/sending",
    yolias: "ربط Gmail وإرسال رسائل التواصل.",
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
    description: "صفحات فيسبوك وحسابات إنستجرام للأعمال: رسائل Messenger وInstagram Direct في صندوق الوارد، وقراءة الإعلانات (يتطلب مراجعة التطبيق لدى Meta).",
    fields: [
      { key: "app_id", label: "App ID", required: true },
      { key: "app_secret", label: "App secret", secret: true, required: true },
      { key: "access_token", label: "Page / system user token", secret: true, required: true },
      { key: "verify_token", label: "Verify token (للرسائل)", secret: true, hint: "نص تختاره وتضعه في إعدادات Webhook لدى Meta لاستقبال رسائل Messenger وInstagram" },
    ],
    capabilities: ["ads.read", "messaging.inbox"],
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
  {
    key: "google_ads", name: "Google Ads", category: "ads", phase: 12, testable: false,
    description: "قراءة أداء الحملات (قراءة فقط).",
    fields: [
      { key: "developer_token", label: "Developer token", secret: true, required: true },
      { key: "customer_id", label: "Customer ID", required: true, hint: "بدون شرطات، مثل 1234567890" },
      { key: "login_customer_id", label: "Manager (MCC) customer ID", hint: "إن كان الوصول عبر حساب مدير" },
      { key: "client_id", label: "OAuth client ID", required: true },
      { key: "client_secret", label: "OAuth client secret", secret: true, required: true },
      { key: "refresh_token", label: "OAuth refresh token", secret: true, required: true, hint: "بصلاحية https://www.googleapis.com/auth/adwords" },
      { key: "api_version", label: "API version", hint: "مثل v20 — حسب الإصدار المدعوم حالياً لدى Google" },
    ],
    capabilities: ["ads.read"],
  },
  {
    key: "docusign", name: "DocuSign", category: "esign", phase: 14, testable: true,
    description: "إرسال العقود للتوقيع واستلام النسخة الموقعة عبر Webhook.",
    fields: [
      { key: "integration_key", label: "Integration key", required: true },
      { key: "account_id", label: "Account ID", required: true },
      { key: "private_key", label: "RSA private key", secret: true, required: true },
      { key: "user_id", label: "Impersonated user ID", required: true },
      { key: "hmac_key", label: "Connect HMAC key", secret: true, hint: "من إعدادات Connect في DocuSign — للتحقق من إشعارات الحالة" },
      { key: "environment", label: "البيئة", hint: "demo (تجريبي) أو production" },
    ],
    capabilities: ["esign.send", "esign.status"],
    webhook: { kind: "hmac_sha256", secretField: "hmac_key" },
  },
];

export const providerMap = new Map(providers.map((p) => [p.key, p]));

export const aiProviders = ["openai", "gemini", "anthropic"] as const;
export type AiProvider = (typeof aiProviders)[number];
