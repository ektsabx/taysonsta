// One-off seed script: creates the real Client + Proposal for Abdullah
// Almuzaini using the verbatim content from the Taysonsta proposal document
// (all 3 Options with their full Scope / Deliverables / Excludes / Roadmap /
// Payment Schedule, reproduced line-for-line from the source document),
// selects the relevant portfolio case studies, and provisions his private
// proposal login.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     ABDULLAH_EMAIL=... [ABDULLAH_PASSWORD=...] \
//     npx tsx scripts/seed-abdullah-proposal.ts
//
// Safe to re-run: it looks up the client by email and the proposal by
// client+title first and updates them in place instead of duplicating.

import { createClientAdmin, type ClientFormInput } from "../services/clients";
import { createProposal, updateProposalBasics, setSelectedProjects } from "../services/proposals";
import { createProposalAccess, getProposalAccessAdmin } from "../services/proposal-access";
import { listCaseStudiesAdmin } from "../services/case-studies-admin";
import { createAdminClient } from "../lib/supabase/admin";
import type { ProposalContent, ProposalPackage } from "../types/proposal";

const CLIENT_EMAIL = process.env.ABDULLAH_EMAIL;
if (!CLIENT_EMAIL) {
  console.error("Missing ABDULLAH_EMAIL env var — set it to Abdullah's real email and re-run.");
  process.exit(1);
}

const ACCESS_PASSWORD = process.env.ABDULLAH_PASSWORD || generatePassword();

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 14; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// ---------------------------------------------------------------------------
// OPTION 01 — AI Agent Customization (source doc section 05)
// ---------------------------------------------------------------------------
const option01: ProposalPackage = {
  id: crypto.randomUUID(),
  name: "AI Agent Customization",
  goal: "تجهيز وتخصيص الـAI Agent الموجود بالفعل داخل بيئة Chatwoot ليصبح مناسبًا لطبيعة العميل.",
  priceLabel: "$1,000 / Client",
  timelineLabel: "5–7 Business Days",
  scope: [
    "01 — Business Understanding: جمع وفهم طبيعة الشركة، المنتجات أو الخدمات، العملاء المستهدفين، الأسئلة المتكررة، أسلوب التواصل، معلومات الشركة، سياسات التعامل مع العملاء، الحالات التي يجب تحويلها إلى موظف.",
    "02 — Knowledge Preparation: تنظيم المعلومات التي سيعتمد عليها الـAgent، مثل Company Information، Products، Services، FAQs، Policies، Delivery Information، Business Rules، Contact Information، Operating Hours.",
    "03 — Agent Instructions: إعداد System Instructions مناسبة لطبيعة الشركة، وتشمل طريقة التصرف، المعلومات التي يمكن استخدامها، المعلومات التي يجب عدم اختراعها، طريقة التعامل مع الأسئلة، الحالات التي تحتاج Human Handoff، حدود الـAgent، أسلوب الرد.",
    "04 — Personality & Communication: ضبط Personality، Tone، Formality، Response Style، Language، Response Length، Customer Interaction Style، بحيث يكون الـAgent مناسبًا للـbrand والعملاء.",
    "05 — Testing: اختبار مجموعة من السيناريوهات الأساسية — الأسئلة العامة، الأسئلة عن المنتجات، الأسئلة عن الخدمات، الأسئلة غير المعروفة، الحالات غير الواضحة، طلب Human Agent، الحالات التي يجب رفض الإجابة عليها.",
    "06 — Refinement: تحليل النتائج وإجراء التعديلات اللازمة على Instructions، Knowledge، Response behavior، Handoff rules، Conversation flow.",
  ],
  deliverables: ["Configured & Tested AI Customer Service Agent داخل بيئة Chatwoot الحالية."],
  excludes: [
    "بناء SaaS.",
    "Multi-Tenancy.",
    "Client Dashboard.",
    "Admin Dashboard جديد.",
    "Custom CRM.",
    "Custom Order System.",
    "Payment Integration.",
    "Product API Integration.",
    "Order Creation.",
    "Order Tracking.",
    "Custom Channels.",
    "Business Automation جديدة.",
    "إعادة بناء Chatwoot.",
    "تطوير Backend تجاري جديد.",
  ],
  roadmap: [],
  paymentMilestones: [{ id: crypto.randomUUID(), label: "Upfront — قبل بدء التنفيذ", percentage: "100%", amount: "$1,000" }],
};

// ---------------------------------------------------------------------------
// OPTION 02 — Chatwoot + Custom Features (source doc section 06, A–Y)
// ---------------------------------------------------------------------------
const option02: ProposalPackage = {
  id: crypto.randomUUID(),
  name: "Chatwoot + Custom Features",
  goal: "تحويل الـAI Agent من Agent قادر على المحادثة إلى Production AI Customer Service & Business Automation Solution متصل بأنظمة العميل. يظل Chatwoot هو بيئة المحادثات الأساسية، بينما يتم تطوير Custom Integration / Automation Layer لتنفيذ العمليات التجارية.",
  priceLabel: "Starting from $12,000",
  timelineLabel: "4–6 Weeks",
  scope: [
    "A — AI Agent Layer: Agent Configuration، Personality، Tone، Language، Business Instructions، Knowledge، Conversation Context، Business Rules، Human Handoff، Out-of-scope handling.",
    "B — Product & Service Integration: الوصول إلى بيانات المنتجات والخدمات من النظام الحقيقي. Product Search حسب Product Name وIngredient وCategory وAttribute وCustomer Description. Product Details تعرض Product Name وDescription وIngredients وSizes وPrices وImages وNutrition Information عند توفرها. Real-Time Pricing: الأسعار لا يتم وضعها داخل Prompt ثابت، يجب قراءة السعر الحالي من الـAPI / Source of Truth عند الحاجة. Availability عند توفر API مناسب: Available، Out of Stock، Available by Branch، Available Options.",
    "C — Recommendations: مساعدة العميل في الاختيار من خلال أسئلة بسيطة مثل ماذا تفضل؟ هل تريد شيئًا خفيفًا؟ هل تريد شيئًا بدون سكر؟ ما الحجم المناسب؟ هل لديك حساسية من مكون معين؟ ثم استخدام المعلومات المتاحة لتقديم خيارات مناسبة — بالاعتماد على البيانات والقواعد المتاحة، وليس على اختراع معلومات غير موجودة.",
    "D — Branches & Locations: عند توفر البيانات — Branch List، Branch Address، Coordinates، Opening Hours، Holiday Hours، Current Open / Closed Status، Nearest Branch، Pickup Branch.",
    "E — Delivery: عند توفر التكامل المطلوب — Delivery Availability، Delivery Zone، Delivery Fee، Estimated Delivery Time، Serving Branch، Minimum Order، Pickup Alternative. إذا كان العنوان خارج منطقة التوصيل، يستطيع الـAgent إخبار العميل بذلك واقتراح Pickup أو البدائل المتاحة.",
    "F — Cart: إنشاء Cart من المحادثة (مثال: \"عايز ٢ مانجو كبير وواحد فراولة صغير\") وتحويله إلى Cart Items، مع دعم Add Item، Remove Item، Change Quantity، Change Size، Change Options، Add / Remove Extras.",
    "G — Order Creation: قبل إنشاء الطلب، يعرض النظام Order Summary تشمل Products، Quantities، Options، Subtotal، Delivery Fee، Total، Pickup / Delivery، Required Customer Information — ولا يتم إنشاء الطلب إلا بعد Explicit Customer Confirmation.",
    "H — Duplicate Order Protection: منع إنشاء نفس الطلب مرتين نتيجة Double Confirmation، Network Retry، Webhook Retry، Timeout، Duplicate Request — عبر Idempotency Keys وRequest Tracking وOrder State Validation.",
    "I — Order Modification: إذا سمح النظام، يمكن للعميل طلب إضافة منتج، حذف منتج، تغيير الكمية، تعديل بيانات الطلب — مع التحقق من حالة الطلب.",
    "J — Order Cancellation: إذا كان الطلب قابلًا للإلغاء يتم تنفيذ الإلغاء وتحديث العميل؛ وإذا لم يعد قابلًا للإلغاء يتم توضيح ذلك وتحويل الحالة إلى Human Agent إذا لزم الأمر.",
    "K — Order Tracking: معرفة الطلب النشط من خلال Customer Identity مثل رقم الهاتف بدون إجبار العميل على تذكر رقم الطلب. الحالات: Received، Preparing، Ready، Out for Delivery، Delivered، Cancelled.",
    "L — Proactive Order Updates: عند توفر Webhooks يتم إرسال التحديثات تلقائيًا عند تغير حالة الطلب؛ وفي حالة عدم وجود Webhooks يمكن استخدام Polling mechanism ضمن حدود النظام والـAPI.",
    "M — Delayed Orders: اكتشاف التأخير، إبلاغ العميل، تقديم المعلومات المتاحة، والتصعيد للبشر عند الحاجة، خصوصًا عند ظهور Complaint أو Anger أو Repeated Follow-up أو Delivery Issue.",
    "N — Payments: بعد تأكيد الطلب يمكن إنشاء Payment Link. Payment Flow: Customer confirms order → System creates order → System requests payment link → Customer receives payment link → Customer completes payment → Payment provider sends webhook → System verifies payment → Order/payment status is updated → Customer receives confirmation. Payment Link Rules لكل Order: Payment Link، Expiry Time، Payment Status — مع التعامل مع Successful Payment وFailed Payment وExpired Payment وRetry وNew Payment Link. إذا كان COD متاحًا يمكن عرضه كخيار حسب Business Rules.",
    "O — Customer Profile: التعامل مع Customer Name وPhone Number وCustomer Identity وPrevious Orders وSaved Addresses وPreferences عند توفر Customer API.",
    "P — Repeat Orders: طلب إعادة آخر طلب (مثال: \"عايز نفس طلب المرة اللي فاتت\") — في حالة توفر Order History يجلب النظام الطلب السابق ويعرضه للتأكيد قبل الإنشاء.",
    "Q — Voice Messages: يمكن دعمها عند توفر خدمة Speech-to-Text مناسبة. الـAgent يستقبل Voice → Transcription → Understanding → Response، ولا يشمل ذلك بناء Speech Recognition Model من الصفر.",
    "R — Image Understanding: عند توفر Vision-capable model/provider يمكن التعامل مع الصور المرسلة داخل المحادثة بحسب طبيعة الـuse case.",
    "S — Conversation Behavior: يجب أن يكون الـAgent قادرًا على التعامل مع Kuwaiti Arabic، Local Expressions، Abbreviations، Typos، Short Messages، Follow-up Messages، Context-dependent Questions — ويجب أن تكون الردود طبيعية ومناسبة للـchannel.",
    "T — Conversation Memory: يحتفظ النظام بالسياق المطلوب أثناء المحادثة — Current Branch، Current Cart، Delivery / Pickup، Customer Preferences، Current Order، Conversation Context — مع الالتزام بحدود البيانات والـprivacy المتفق عليها.",
    "U — Human Handoff: تحويل المحادثة للبشر عند Customer explicitly asks for human، Two consecutive understanding failures، Complaint، Angry customer، Refund request، Compensation request، Payment failure، Order technical failure، Integration failure، Sensitive business case. Handoff Process: Inform customer → Transfer conversation → Select appropriate Chatwoot team/inbox → Add internal context summary → AI stops responding → Human Agent handles conversation → AI can be reactivated when appropriate.",
    "V — Follow-Up Automation (Phase 2 / Optional Scope): Abandoned Cart — بعد مدة محددة مثل ساعة يمكن إرسال Reminder واحد. Post-Delivery Rating — بعد فترة محددة من التسليم يمكن طلب تقييم. Re-engagement — للعملاء غير النشطين لفترة محددة، باستخدام القنوات والقواعد المسموح بها. أي رسائل خارج النوافذ والقواعد الخاصة بالـchannel يجب أن تعتمد على آليات القناة الرسمية والقوالب المطلوبة.",
    "W — Reporting: Number of Conversations، AI Resolution Rate، Orders، Order Value، Most Asked Products، Most Ordered Products، Failed Questions، Human Handoffs، Handoff Reasons، Average Response Time، Business Action Success / Failure.",
    "X — Production QA: قبل الإطلاق يتم اختبار Conversation Flows، Product Search، Pricing، Cart، Order Creation، Payment، Tracking، Human Handoff، Error Handling، API Failures، Duplicate Requests، Webhooks، Retry Scenarios.",
    "Y — API Discovery & Validation: قبل تنفيذ أي Business Automation يتم فحص الأنظمة التي سيعتمد عليها المشروع — Authentication، API Documentation، Endpoints، Request Format، Response Format، Required Fields، Error Responses، Rate Limits، Webhooks، Sandbox، Production Credentials، Order States، Payment States، Availability Logic.",
  ],
  deliverables: [
    "Configured AI Agent",
    "Business Automation Layer",
    "Product Integration",
    "Real-Time Pricing",
    "Availability Integration where supported",
    "Branch Logic",
    "Delivery Logic where supported",
    "Cart",
    "Order Creation",
    "Order Modification where supported",
    "Order Cancellation where supported",
    "Order Tracking",
    "Payment Link",
    "Payment Webhook",
    "Customer Context",
    "Human Handoff",
    "Notifications",
    "Retry / Error Handling",
    "Idempotency",
    "Production QA",
  ],
  excludes: [
    "بناء SaaS Platform عامة.",
    "Multi-Tenant Architecture.",
    "Self-Service Client Dashboard.",
    "SaaS Billing.",
    "إعادة بناء Chatwoot بالكامل.",
    "Custom POS.",
    "Custom ERP.",
    "Custom E-commerce Backend.",
    "بناء Payment Gateway.",
    "بناء Delivery Fleet System.",
    "بناء LLM من الصفر.",
    "بناء Speech Model من الصفر.",
    "بناء Vision Model من الصفر.",
    "إنشاء APIs غير موجودة لدى العميل.",
  ],
  roadmap: [],
  paymentMilestones: [
    { id: crypto.randomUUID(), label: "Start — توقيع الاتفاق وبدء العمل", percentage: "50%", amount: "الدفعة الأولى" },
    { id: crypto.randomUUID(), label: "Development Milestone", percentage: "25%", amount: "الدفعة الثانية" },
    { id: crypto.randomUUID(), label: "Final Delivery", percentage: "25%", amount: "الدفعة الثالثة" },
  ],
};

// ---------------------------------------------------------------------------
// OPTION 03 — Full SaaS: Multi-Tenant AI Customer Service Platform
// (source doc section 07 — Core SaaS Scope, then Platform Capability Roadmap A–AJ)
// ---------------------------------------------------------------------------
const option03: ProposalPackage = {
  id: crypto.randomUUID(),
  name: "Full SaaS — Multi-Tenant AI Customer Service Platform",
  goal: "بناء منتج SaaS مستقل وقابل لإعادة الاستخدام، يوفر للشركات منصة متكاملة لإدارة المحادثات والـAI Agents والعمليات التجارية. Option 03 مختلف جوهريًا عن Option 02: في Option 02 نبني حلًا مخصصًا للعميل، أما في Option 03 فنبني المنتج نفسه — Taysonsta = Technology Builder، وعبدالله = SaaS Owner / Business Owner المالك الكامل للمنتج والبيزنس الناتج عنه.",
  priceLabel: "$25,000 — Fixed Price (Core SaaS Scope)",
  timelineLabel: "8–12 Weeks",
  scope: [
    "Multi-Tenancy Foundation — إنشاء وعزل الـTenants (Workspaces) الأساسية.",
    "Authentication — تسجيل الدخول، إدارة الجلسات، دعوة المستخدمين.",
    "Roles & Permissions (Core) — أدوار أساسية على مستوى الـPlatform والـTenant.",
    "Conversation Platform (Core) — المحادثات، الـInbox، الـContacts، التعيين، البحث.",
    "Channel Management — القنوات المعتمدة ضمن Phase 1 scope النهائي.",
    "AI Agent Engine — تشغيل Agent واحد أو أكثر لكل Tenant مع الشخصية والتعليمات والمعرفة.",
    "Knowledge Management (Core) — إدارة معلومات كل شركة التي يعتمد عليها الـAgent.",
    "Business Action Layer (Core) — تنفيذ العمليات الأساسية: البحث عن المنتجات، الأسعار الحية، التوفر، الـCart، إنشاء الطلب، رابط الدفع، تتبع الطلب — بحسب الـIntegrations المعتمدة في Phase 1.",
    "Integration Framework (Foundation) — بنية عامة لإضافة Integrations، مع تفعيل أول Integration/Integrations فعلية للعميل الأول (عصير الضاحية) كنموذج تحقق.",
    "Human Handoff — تحويل المحادثة لموظف بشري.",
    "Client Dashboard (Core) — Overview، Agents، Conversations، Knowledge، Integrations، Business Settings، Usage.",
    "Admin Dashboard (Core) — Tenants، Users، Agents، Integrations، Usage، System Health.",
    "Webhooks Handling — استقبال ومعالجة الـWebhooks الأساسية (دفع، حالة طلب).",
    "Notification Engine (Core Events) — الأحداث الأساسية مثل تأكيد الطلب ونجاح الدفع.",
    "Billing & Subscription Foundation — Plans، Subscriptions، Checkout، Recurring Billing، Trial، Upgrade، Downgrade، Cancellation، Usage Limits — بما أن المنصة منتج SaaS تجاري قابل للبيع منذ اليوم الأول، هذه الطبقة أساسية ضمن الـCore Scope وليست جزءًا مؤجلًا.",
    "Data Isolation — فصل بيانات كل Tenant.",
    "Production QA — اختبار شامل قبل الإطلاق التجاري.",
    "Final implementation is subject to API availability, documentation, credentials, and technical validation. أي عنصر يعتمد على API أو نظام خارجي لدى العميل أو لدى شركة مستأجرة مستقبلية يخضع لمدى توفر ذلك الـAPI فعليًا.",
  ],
  deliverables: [
    "Multi-Tenant SaaS Architecture",
    "Authentication",
    "Tenant Management",
    "Roles & Permissions",
    "Client Dashboard",
    "Admin Dashboard",
    "Conversation Platform",
    "Channel Management",
    "AI Agent Engine",
    "Multi-Agent Support",
    "Agent Configuration",
    "Knowledge Management",
    "Agent Playground",
    "Agent Versioning",
    "Business Configuration",
    "Business Action Permissions",
    "Integration Framework",
    "Product Layer",
    "Customer Layer",
    "Cart",
    "Order Automation",
    "Payment Automation",
    "Order Tracking",
    "Human Handoff",
    "Webhooks",
    "Notifications",
    "Background Jobs",
    "Retry / Idempotency",
    "Usage Tracking",
    "AI Usage Tracking",
    "Audit Logs",
    "Monitoring",
    "SaaS Plan Foundation",
    "Subscription Lifecycle Foundation where included",
    "Data Isolation",
    "Backup / Recovery approach",
    "Production QA",
    "Launch-ready SaaS Platform",
  ],
  excludes: [
    "Custom ERP، Custom POS، Custom E-commerce Backend.",
    "بناء Payment Gateway.",
    "بناء Delivery Fleet System.",
    "بناء LLM أو Speech Model أو Vision Model من الصفر.",
  ],
  // Platform Capability Roadmap — Full Platform Vision, Beyond the $25,000 Core Scope (source doc section 07, A–AJ)
  roadmap: [
    "A — Multi-Tenancy: Tenant Creation، Tenant Isolation، Tenant Settings، Tenant Data، Tenant Users، Tenant Agents، Tenant Channels، Tenant Integrations، Tenant Usage، Tenant Analytics.",
    "B — Authentication: Sign Up، Login، Logout، Password Reset، Email Verification عند الحاجة، Session Management، Workspace Membership، User Invitations.",
    "C — Roles & Permissions: Platform Roles مثل Platform Owner وPlatform Admin وSupport وOperations؛ Tenant Roles مثل Owner وAdmin وManager وAgent وViewer، مع إمكانية تحديد ما يستطيع كل role الوصول إليه.",
    "D — Conversation Platform: Conversations، Contacts، Inbox، Teams، Agents، Assignment، Tags، Notes، Status، Search، Conversation History، Internal Comments، Customer Context.",
    "E — Channel Management: Connect Channel، Disconnect Channel، Connection Status، Authentication، Webhooks، Message Routing، Assignment، Channel Settings.",
    "F — AI Agent Management: Create Agent، Edit Agent، Activate / Deactivate، Personality، Tone، Language، Instructions، Knowledge، Business Rules، Tools، Permissions، Escalation Rules.",
    "G — Multi-Agent Support: إدارة أكثر من Agent مثل Sales Agent وCustomer Service Agent وOrder Agent وSupport Agent وBooking Agent، بحسب طبيعة الشركة.",
    "H — Agent Playground: اختبار الـAgent داخل بيئة تجريبية قبل النشر — Questions، Products، Business Rules، Tool Calls، Responses، Handoff، Order Flow.",
    "I — Agent Versioning: Version History، Published Version، Draft Version، Rollback، Change Tracking — بحيث لا يؤدي تعديل جديد إلى فقدان configuration سابقة.",
    "J — Knowledge Management: Business Information، FAQs، Products، Services، Policies، Delivery Rules، Support Information، مع إدارة مصادر المعرفة حسب الـscope المعتمد.",
    "K — Business Configuration: Business Hours، Languages، Tone، Handoff Rules، Order Rules، Payment Rules، Delivery Rules، Confirmation Rules، Notification Rules.",
    "L — Business Action Permissions: لكل Action تحديد Allowed أو Disabled أو Requires Confirmation أو Requires Human Approval — أمثلة: Create Order، Cancel Order، Refund، Payment، Customer Modification، Discount، Compensation.",
    "M — Integration Framework: بنية قابلة لإضافة integrations لـProduct Systems وE-commerce وPOS وCRM وPayment Providers وDelivery Systems وBooking Systems وERP وCustom APIs.",
    "N — Secure API Credentials: API Keys، Access Tokens، Webhook Secrets، Connection Status، Credential Rotation عند الحاجة — بدون عرض credentials حساسة بشكل مكشوف داخل الـUI.",
    "O — Real-Time Business Data: Price، Availability، Order Status، Delivery Status، Payment Status — عبر الوصول إلى الـSource of Truth من خلال integration المناسبة.",
    "P — Product & Catalog Layer: Products، Categories، Variants، Prices، Attributes، Availability، Images، Branch-specific Availability.",
    "Q — Customer Layer: Customer Identity، Phone، Name، History، Orders، Preferences، Addresses، Conversations.",
    "R — Order Automation: Create Order، Modify Order، Cancel Order، Lookup Order، Track Order — مع Validation وConfirmation وIdempotency وError Handling وRetry.",
    "S — Payment Automation: Payment Link Generation، Payment Status، Payment Webhooks، Expiry، Failed Payment، Retry، Confirmation.",
    "T — Notification Engine: Order Confirmed، Payment Successful، Order Status Changed، Delivery Update، Human Handoff، Integration Failure، Usage Limit، Agent Error.",
    "U — Workflow & Background Jobs: Follow-ups، Polling، Retry، Delayed Notifications، Abandoned Cart، Rating Requests، Re-engagement، Webhook Processing.",
    "V — Webhooks: Payment Webhooks، Order Status Webhooks، Integration Events — مع Signature Verification وIdempotency وRetry Handling وFailure Logging.",
    "W — Human Handoff: Handoff Triggers، Handoff Teams، Escalation Rules، Business Hours، Priority — مع نقل الـcontext الكامل للـHuman Agent.",
    "X — Client Dashboard: Overview (المحادثات، AI Resolution، الطلبات، الأحداث المرتبطة بالإيراد، التحويلات، زمن الرد، أداء الـAgent)، Agents، Conversations، Knowledge، Integrations، Business Settings، Usage.",
    "Y — Admin Dashboard (Platform): Tenants (الكل/نشط/معلّق/تجريبي/ملغى)، Users، Agents، Integrations، Usage، Billing، System Health.",
    "Z — SaaS Plans: Starter للشركات الصغيرة، Growth للاستخدام الأعلى، Enterprise للشركات الأكبر والصلاحيات المتقدمة — الأسعار النهائية تُحدَّد بعد اختبار الـunit economics والتكاليف الفعلية.",
    "AA — Subscription Lifecycle: Trial، Active، Past Due، Grace Period، Suspended، Cancelled — مع الأحداث المرتبطة بكل حالة.",
    "AB — Usage Tracking: Conversations، Messages، AI Requests، Agent Runs، Tool Calls، Business Actions، Integrations، Storage.",
    "AC — AI Cost Tracking: AI Requests، Token / Usage Data، Cost Estimates، Cost by Tenant، Cost by Agent — لتحديد الـgross margin الحقيقي لكل Tenant.",
    "AD — Audit Logs: User Login، Agent Changes، Permission Changes، Integration Changes، API Configuration، Business Action، Order Action، Admin Action.",
    "AE — Data Isolation: فصل بيانات كل Tenant (Conversations، Customers، Agents، Knowledge، Integrations، Orders، Usage، Analytics).",
    "AF — Data Export & Deactivation: Tenant Deactivation، Data Export، Account Suspension، Account Cancellation وفقًا للسياسات التجارية والقانونية.",
    "AG — Monitoring & Observability: Structured Logs، Error Tracking، Performance Monitoring، Integration Monitoring، Background Job Monitoring، Alerts.",
    "AH — Retry & Failure Handling: API Timeout، Network Failure، Webhook Retry، Payment Failure، Integration Failure، Temporary Provider Failure — عبر Retry Policies وIdempotency وError States وLogging وCustomer-safe Responses.",
    "AI — Scalability: تصميم الـarchitecture ليسمح بإضافة المزيد من Tenants وAgents وConversations وChannels وIntegrations وBusiness Actions بدون إعادة بناء النظام بالكامل.",
    "AJ — Backup & Recovery: Data Backup، Recovery، Critical Configuration Recovery، Disaster Handling وفقًا للبنية التحتية المختارة.",
  ],
  paymentMilestones: [
    { id: crypto.randomUUID(), label: "Start", percentage: "40%", amount: "$10,000" },
    { id: crypto.randomUUID(), label: "Midpoint", percentage: "30%", amount: "$7,500" },
    { id: crypto.randomUUID(), label: "Beta / UAT", percentage: "20%", amount: "$5,000" },
    { id: crypto.randomUUID(), label: "Production Launch", percentage: "10%", amount: "$2,500" },
  ],
};

const content: ProposalContent = {
  overview:
    "يهدف المشروع إلى تطوير حل متكامل لخدمة العملاء يستطيع التعامل مع العملاء بصورة طبيعية، وفهم احتياجاتهم، والرد على استفساراتهم، والوصول إلى البيانات الحقيقية الخاصة بالشركة، وتنفيذ الإجراءات التجارية المطلوبة بدلًا من الاكتفاء بإرسال إجابات نصية.\n\nالفكرة الأساسية ليست مجرد بناء Chatbot يجيب عن الأسئلة. الهدف هو بناء AI Customer Service Agent قادر على العمل كجزء من فريق الشركة.\n\nبحسب طبيعة النظام المتصل به، يمكن للـAgent أن يقوم بمهام مثل: فهم المنتجات والخدمات، البحث عن المنتجات، عرض الأسعار الحالية، عرض تفاصيل المنتجات، التحقق من التوفر، مساعدة العميل في الاختيار، بناء سلة شراء، تعديل السلة، جمع بيانات الطلب، إنشاء الطلب، إنشاء رابط الدفع، متابعة حالة الطلب، التعامل مع بيانات العميل، إرسال تحديثات، التعامل مع الطلبات المتكررة، تحويل الحالات للبشر عند الحاجة، تنفيذ Follow-ups، وتسجيل وتحليل نتائج المحادثات.\n\nويختلف مستوى هذه القدرات حسب المسار المختار وحسب الأنظمة والـAPIs المتاحة لدى العميل.\n\nالمشروع لديه مساران محتملان — المسار الأول: Solve the Immediate Need (تجهيز AI Agent لخدمة العملاء بسرعة، ثم تطويره ليتصل بأنظمة العميل وينفذ العمليات المطلوبة). المسار الثاني: Build the Product (تحويل الخبرة والتكنولوجيا التي يتم تطويرها إلى منصة SaaS يمكن استخدامها مع عدد كبير من الشركات، بحيث تصبح عملية إضافة عميل جديد أقرب إلى Connect → Configure → Test → Launch بدلًا من إعادة بناء النظام من البداية لكل عميل).",
  clientProblem: "",
  clientGoals: "",
  proposedSolution:
    "الهدف النهائي للمشروع هو بناء طبقة جديدة بين الشركة وعملائها: Understand → Decide → Act → Confirm → Track → Escalate. أي أن الـAgent لا يكتفي بفهم السؤال والرد عليه، ولكنه يستطيع — عند توفر التكاملات والصلاحيات اللازمة — تنفيذ الإجراء نفسه.\n\nتم استخدام عصير الضاحية في هذا المقترح كمثال عملي (Initial Use Case) لفهم نوع العمليات المطلوبة — مثال: \"أريد عصير مانجو بدون سكر\" ويستطيع الـAgent فهم الطلب، البحث في المنتجات، التحقق من التوفر، قراءة السعر الحالي، عرض الخيارات، إضافة المنتج إلى Cart، طلب Delivery أو Pickup، عرض ملخص الطلب، الحصول على تأكيد واضح، إنشاء الطلب، إنشاء Payment Link، متابعة الدفع والطلب، إرسال التحديثات، وتحويل العميل إلى Human Agent إذا ظهرت مشكلة.\n\nلكن نفس الـarchitecture قابلة للتطبيق على Restaurants وE-commerce وRetail وClinics وServices وEducation وHospitality وMarketplaces وSubscription Businesses وغيرها، مع اختلاف الـBusiness Logic والـIntegrations لكل شركة.\n\nهذا المقترح يقدم 3 مسارات مستقلة (يمكن اختيار أي منها بشكل مستقل، وليست مراحل إجبارية متتالية):\n\nOPTION 01 — AI Agent Customization: تخصيص وتجهيز AI Agent موجود داخل بيئة Chatwoot الحالية.\n\nOPTION 02 — Chatwoot + Custom Features: الاحتفاظ ببيئة Chatwoot الحالية وإضافة طبقة Business Automation وربط الـAgent بأنظمة العميل لتنفيذ عمليات حقيقية مثل المنتجات والأسعار والطلبات والدفع والتتبع والتحويل للبشر.\n\nOPTION 03 — Full SaaS (Multi-Tenant AI Customer Service Platform): بناء منصة SaaS قابلة للبيع لعدة شركات، تجمع بين Conversation Platform ومحرك AI Agents وBusiness Automation وMulti-Tenancy وClient Dashboard وAdmin Dashboard وIntegrations.",
  packages: [option01, option02, option03],
  paymentTerms:
    "الأسعار الموضحة هي Starting From لـOption 01 وOption 02، وليست Fixed Price لكل أنواع المشاريع في هذين الخيارين — التكلفة النهائية تعتمد على عدد القنوات والتكاملات وتعقيد الـAPI وعدد الإجراءات التجارية والبنية التحتية الحالية وProvider الدفع ونظام الطلبات ونظام التوصيل ومتطلبات الـDashboard وSaaS Billing والمتطلبات المؤسسية. أما Option 03 فسعره $25,000 Fixed لنطاق الـCore SaaS Scope المحدد بالتفصيل. أي تغيير جوهري بعد اعتماد الـscope قد يتم التعامل معه كـChange Request.\n\nالتكاليف التالية ليست ضمن الاستثمار إلا إذا نُص عليها صراحة: AI Model/API Usage، WhatsApp / Meta Fees، SMS Fees، Payment Gateway Fees، Cloud Infrastructure، Database، Storage، Monitoring، External SaaS Services، Third-Party APIs، Communication Provider Fees، Domain / Email Services — وتُحمَّل على العميل أو الشركة المالكة للمنصة حسب الـcommercial structure المتفق عليه.\n\nUpgrade Path Between Options — Option 01 → Option 02: يتم خصم قيمة $1,000 (Option 01) بالكامل من استثمار Option 02، بشرط أن تتم الترقية خلال 30 يومًا من تسليم Option 01. Option 02 → Option 03: يتم احتساب جزء من المبلغ المدفوع في Option 02 كـCredit جزئي (وليس كاملًا) تجاه Option 03، بعد تقييم الأعمال والمكوّنات القابلة لإعادة الاستخدام فعليًا في بنية Option 03 — وذلك لأن Option 02 عبارة عن تطوير مخصص فوق بيئة Chatwoot الحالية للعميل، بينما Option 03 منتج SaaS مستقل ومملوك بالكامل للعميل بـarchitecture مختلفة جوهريًا.",
  nextSteps:
    "فترة الدعم المتضمنة (Included Support) من تاريخ التسليم النهائي: 30 يومًا لـOption 01، و60 يومًا لكل من Option 02 وOption 03. بعد انتهاء فترة الدعم المتضمنة يمكن الاستمرار اختياريًا عبر باقة Optional Maintenance & Technical Support بقيمة $300 شهريًا — تشمل Technical Support وBug Fixing وTroubleshooting وMaintenance للأجزاء التي قامت Taysonsta بتسليمها، ولا تشمل New Features أو New Integrations أو Major Changes أو New Product Modules أو Third-party/API Changes Requiring Development أو Product Redesign أو New Business Requirements.\n\nفي حالة اختيار Option 03: Taysonsta = Technology Builder — الجهة المنفذة لبناء المنصة. عبدالله = SaaS Owner / Business Owner — المالك الكامل للمنتج والبيزنس الناتج عنه. بعد التسليم واستلام كامل قيمة المشروع، تصبح المنصة + Source Code + IP + Product ملكية كاملة لعبدالله، بما يشمل حق تشغيل المنصة وبيعها للشركات وتحديد الأسعار وعمل Subscriptions وبيع Plans وإضافة عملاء وإدارة الـSaaS Business بالكامل — ولا تحتفظ Taysonsta بملكية الـCore Platform في هذا الخيار. النطاق الدقيق للـExclusivity، خصوصًا فيما يتعلق بأي Libraries أو Open-Source Components أو خدمات طرف ثالث مستخدمة داخل المنصة، يتم تحديده بالتفصيل في العقد المنفصل. بعد التسليم النهائي، العمليات التشغيلية اليومية (Hosting، Server/Infrastructure، AI API Costs، Security Operations، Monitoring، Backups، Updates، Third-Party Services، Customer Support، New Integrations، SaaS Operations) تكون مسؤولية عبدالله بالكامل.\n\nللبدء، يرجى مراجعة المقترح واختيار المسار المناسب (Option 01 أو 02 أو 03)، أو التواصل لمناقشة أي استفسارات قبل الموافقة النهائية.",
  closingNote:
    "This proposal contains confidential business, product, technical, and commercial information prepared specifically for the intended recipient. The information contained in this document is provided for evaluation and discussion purposes only and may not be reproduced, distributed, or shared with third parties without prior written approval from Taysonsta.",
};

const SELECTED_PROJECT_TITLES = ["LITMINI", "fireMINI", "Fobla", "TrEndlix", "thugsspeacker", "healwedeal", "Qayed"];

async function main() {
  const clientInput: ClientFormInput = {
    name: "Abdullah Almuzaini",
    companyName: "",
    email: CLIENT_EMAIL!,
    phone: "",
    country: "",
    website: "",
    notes: "Prepared by Yusuf Waleed — Taysonsta. Initial Use Case: عصير الضاحية.",
  };

  const admin = createAdminClient();
  const { data: existing } = await admin.from("clients").select("id").eq("email", CLIENT_EMAIL!).maybeSingle();

  const clientId = existing?.id ?? (await createClientAdmin(clientInput, null));
  console.log(`Client: ${clientId} (${existing ? "reused existing" : "created"})`);

  const { data: existingProposal } = await admin
    .from("proposals")
    .select("id")
    .eq("client_id", clientId)
    .eq("title", "AI Customer Service & Business Automation")
    .maybeSingle();

  const proposalId =
    existingProposal?.id ??
    (await createProposal({
      clientId,
      title: "AI Customer Service & Business Automation",
      subtitle: "مقترح تطوير وتشغيل منصة — Initial Use Case: عصير الضاحية",
      createdBy: null,
    }));
  console.log(`Proposal: ${proposalId} (${existingProposal ? "reused existing — content overwritten" : "created"})`);

  await updateProposalBasics(proposalId, {
    title: "AI Customer Service & Business Automation",
    subtitle: "مقترح تطوير وتشغيل منصة — Initial Use Case: عصير الضاحية",
    content,
  });
  console.log("Content saved (full verbatim Options 01/02/03).");

  const allCaseStudies = await listCaseStudiesAdmin();
  const matched = allCaseStudies.filter((cs) => SELECTED_PROJECT_TITLES.includes(cs.title));
  await setSelectedProjects(
    proposalId,
    matched.map((cs) => cs.id)
  );
  console.log(`Selected projects: ${matched.map((cs) => cs.title).join(", ") || "(none matched)"}`);

  const access = await getProposalAccessAdmin(proposalId);
  if (!access) {
    await createProposalAccess(proposalId, CLIENT_EMAIL!, ACCESS_PASSWORD);
    console.log(`Access created — email: ${CLIENT_EMAIL} / password: ${ACCESS_PASSWORD}`);
    console.log("⚠️  Save this password now — it will not be shown again.");
  } else {
    console.log(`Access already exists for ${access.email} — leaving password unchanged.`);
  }

  console.log("\nDone. Draft is ready to review in /admin/proposals — publish it from there when ready.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
