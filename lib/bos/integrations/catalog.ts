// Integration Hub catalogue (docs/bos/30 §7, doc 31 Phase 4). Definitions
// only — no secrets. `secret: true` fields are encrypted at rest and never
// sent back to the browser; the UI shows a 4-character hint at most.
// `phase` = the upgrade phase whose features use the connection (the hub can
// store and test credentials before that phase lands).

export type ProviderCategory = "email" | "ai" | "messaging" | "google" | "social" | "ads" | "esign" | "payments" | "maps";

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
  webhook?: { kind: "svix" | "meta_hmac" | "hmac_sha256" | "twilio" | "telegram_secret"; secretField: string };
  phase: number;
  docs?: string;
}

export const categoryLabels: Record<ProviderCategory, string> = {
  email: "البريد الإلكتروني",
  ai: "الذكاء الاصطناعي",
  messaging: "واتساب والرسائل النصية",
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
  },
  {
    key: "gemini", name: "Google Gemini", category: "ai", phase: 4, testable: true,
    description: "نماذج Gemini للنصوص والصور.",
    fields: [
      { key: "api_key", label: "مفتاح API", secret: true, required: true },
      { key: "model", label: "النموذج الافتراضي", required: true, placeholder: "gemini-2.5-flash" },
    ],
    capabilities: ["ai.text", "ai.json", "ai.embeddings"],
    docs: "https://ai.google.dev/gemini-api/docs",
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
  },
  {
    key: "whatsapp_cloud", name: "WhatsApp Business (Cloud API)", category: "messaging", phase: 9, testable: true,
    description: "إرسال واستقبال رسائل واتساب عبر Meta Cloud API والقوالب المعتمدة.",
    fields: [
      { key: "access_token", label: "رمز الوصول الدائم", secret: true, required: true },
      { key: "phone_number_id", label: "Phone number ID", required: true },
      { key: "business_account_id", label: "WhatsApp Business Account ID", required: true },
      { key: "app_secret", label: "App secret", secret: true, hint: "للتحقق من توقيع Webhooks (X-Hub-Signature-256)" },
      { key: "verify_token", label: "Verify token", secret: true, hint: "نص تختاره وتضعه في إعدادات Webhook لدى Meta" },
    ],
    capabilities: ["messaging.whatsapp.send", "messaging.whatsapp.receive", "messaging.templates"],
    webhook: { kind: "meta_hmac", secretField: "app_secret" },
    docs: "https://developers.facebook.com/docs/whatsapp/cloud-api",
  },
  {
    key: "twilio", name: "Twilio SMS", category: "messaging", phase: 9, testable: true,
    description: "رسائل SMS (تنبيهات، رموز، تذكيرات).",
    fields: [
      { key: "account_sid", label: "Account SID", required: true },
      { key: "auth_token", label: "Auth token", secret: true, required: true },
      { key: "from", label: "رقم أو اسم المرسل", required: true },
    ],
    capabilities: ["messaging.sms.send", "messaging.sms.receive"],
    webhook: { kind: "twilio", secretField: "auth_token" },
    docs: "https://www.twilio.com/docs/sms",
  },
  {
    key: "google_maps", name: "Google Maps Platform", category: "maps", phase: 19, testable: true,
    description: "الخرائط والعناوين (Geocoding) — للمواقع المصرّح بها فقط.",
    fields: [{ key: "api_key", label: "مفتاح API", secret: true, required: true, hint: "قيّد المفتاح بنطاق موقعك وبالواجهات المستخدمة فقط" }],
    capabilities: ["maps.geocode", "maps.embed"],
    docs: "https://developers.google.com/maps",
  },
  {
    key: "google_workspace", name: "Google Workspace (OAuth)", category: "google", phase: 5, testable: false,
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
    description: "صفحات فيسبوك وحسابات إنستجرام للأعمال: رسائل Messenger وInstagram Direct في صندوق الوارد، والنشر والتحليلات (يتطلب مراجعة التطبيق لدى Meta).",
    fields: [
      { key: "app_id", label: "App ID", required: true },
      { key: "app_secret", label: "App secret", secret: true, required: true },
      { key: "access_token", label: "Page / system user token", secret: true, required: true },
      { key: "verify_token", label: "Verify token (للرسائل)", secret: true, hint: "نص تختاره وتضعه في إعدادات Webhook لدى Meta لاستقبال رسائل Messenger وInstagram" },
    ],
    capabilities: ["social.publish", "social.insights", "ads.read", "messaging.inbox"],
    webhook: { kind: "meta_hmac", secretField: "app_secret" },
    docs: "https://developers.facebook.com/docs/graph-api",
  },
  {
    key: "telegram", name: "Telegram Bot", category: "social", phase: 10, testable: true,
    description: "رسائل العملاء إلى البوت تصل صندوق الوارد ويُرد عليها من هنا، والنشر في القنوات عبر البوت.",
    fields: [
      { key: "bot_token", label: "Bot token (من BotFather)", secret: true, required: true },
      { key: "webhook_secret", label: "Webhook secret", secret: true, hint: "يُولَّد تلقائياً عند تفعيل استقبال الرسائل من صفحة قنوات المراسلة" },
    ],
    capabilities: ["social.publish", "messaging.inbox"],
    webhook: { kind: "telegram_secret", secretField: "webhook_secret" },
    docs: "https://core.telegram.org/bots/api",
  },
  {
    key: "linkedin", name: "LinkedIn", category: "social", phase: 10, testable: false,
    description: "صفحة الشركة: النشر والتحليلات (يتطلب صلاحيات Marketing Developer Platform).",
    fields: [
      { key: "client_id", label: "Client ID", required: true },
      { key: "client_secret", label: "Client secret", secret: true, required: true },
    ],
    capabilities: ["social.publish", "social.insights", "ads.read"],
    docs: "https://learn.microsoft.com/linkedin/",
  },
  {
    key: "tiktok", name: "TikTok for Business", category: "social", phase: 10, testable: false,
    description: "النشر والتحليلات والإعلانات (يتطلب موافقة TikTok على التطبيق).",
    fields: [
      { key: "app_id", label: "App ID", required: true },
      { key: "app_secret", label: "App secret", secret: true, required: true },
    ],
    capabilities: ["social.publish", "ads.read"],
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
