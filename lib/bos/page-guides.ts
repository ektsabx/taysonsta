// In-page guide (docs/bos/35 B2): what each page is, what it is responsible
// for, who uses it and how. Matched by the longest route prefix. Text lives
// here in both languages so the guide is written for end users, not devs.

export interface GuideText { title: string; purpose: string; owner: string; steps: string[] }
export interface PageGuide { ar: GuideText; en: GuideText }

const g = (ar: GuideText, en: GuideText): PageGuide => ({ ar, en });

export const pageGuides: Record<string, PageGuide> = {
  "/admin/dashboard": g(
    { title: "لوحة التحكم", purpose: "ملخص يومي لأهم الأرقام والمهام حسب دورك وصلاحياتك.", owner: "كل مستخدم يرى ما يخصه فقط.", steps: ["راجع المؤشرات والتنبيهات في الأعلى.", "افتح أي بطاقة للانتقال إلى التفاصيل.", "استخدم «تخصيص» لترتيب البطاقات."] },
    { title: "Dashboard", purpose: "A daily summary of the key numbers and tasks for your role and permissions.", owner: "Every user sees only what applies to them.", steps: ["Review the indicators and alerts at the top.", "Open any card to go to the details.", "Use “Customize” to arrange the cards."] },
  ),
  "/admin/assistant": g(
    { title: "المساعد الذكي", purpose: "اسأل عن بيانات الشركة بلغة طبيعية واحصل على إجابة من البيانات التي تملك صلاحية رؤيتها.", owner: "كل مستخدم، في حدود صلاحياته.", steps: ["اكتب سؤالك (مثل: الفواتير المتأخرة هذا الشهر).", "راجع الإجابة والروابط المرفقة.", "افتح الرابط للتحقق من التفاصيل."] },
    { title: "AI assistant", purpose: "Ask about company data in plain language and get answers from the data you are allowed to see.", owner: "Every user, within their permissions.", steps: ["Type your question (e.g. overdue invoices this month).", "Review the answer and attached links.", "Open a link to check the details."] },
  ),
  "/admin/products": g(
    { title: "المنتجات والخدمات", purpose: "قائمة ما تبيعه الشركة: الأسماء والأسعار والأوصاف والحالة، وتُستخدم في الصفقات والمقترحات والفواتير وقوالب المشاريع.", owner: "الإدارة ومن لديه صلاحية إدارة المنتجات.", steps: ["أضف منتجاً أو خدمة بسعرها وعملتها ونموذج التسعير.", "أوقف ما لم يعد متاحاً بدلاً من حذفه.", "راجع جدول «الاستخدام» لمعرفة أين يُستخدم كل عنصر."] },
    { title: "Products & services", purpose: "What the company sells: names, prices, descriptions and status, used in deals, proposals, invoices and project templates.", owner: "Management and whoever can manage products.", steps: ["Add a product or service with its price, currency and pricing model.", "Deactivate items that are no longer offered instead of deleting them.", "Check the “Usage” table to see where each item is used."] },
  ),
  "/admin/sales/leads": g(
    { title: "العملاء المحتملون", purpose: "كل الفرص الجديدة قبل تحويلها إلى صفقات.", owner: "فريق المبيعات وتطوير الأعمال.", steps: ["أضف عميلاً محتملاً أو استورد قائمة.", "سجّل الأنشطة وحدد الموعد التالي.", "حوّله إلى صفقة عند التأهيل."] },
    { title: "Leads", purpose: "All new opportunities before they become deals.", owner: "Sales and business development.", steps: ["Add a lead or import a list.", "Log activities and set the next follow-up.", "Convert it to a deal once qualified."] },
  ),
  "/admin/sales/deals": g(
    { title: "الصفقات", purpose: "متابعة الصفقات من التفاوض حتى الكسب أو الخسارة.", owner: "مسؤولو المبيعات ومديرهم.", steps: ["حدّث المرحلة والقيمة والاحتمالية.", "أرفق المقترح والعقد.", "سجّل سبب الخسارة عند الإغلاق."] },
    { title: "Deals", purpose: "Track deals from negotiation to won or lost.", owner: "Sales owners and their manager.", steps: ["Update the stage, value and probability.", "Attach the proposal and contract.", "Record the loss reason when closing."] },
  ),
  "/admin/sales/activities": g(
    { title: "الأنشطة", purpose: "المكالمات والاجتماعات والمتابعات المرتبطة بالعملاء والصفقات.", owner: "كل من يتواصل مع العملاء.", steps: ["سجّل النشاط فور حدوثه.", "حدد تاريخ المتابعة التالية.", "استخدم الفلاتر لرؤية المتأخر."] },
    { title: "Activities", purpose: "Calls, meetings and follow-ups linked to clients and deals.", owner: "Everyone who talks to clients.", steps: ["Log the activity as it happens.", "Set the next follow-up date.", "Use filters to see what is overdue."] },
  ),
  "/admin/sales/proposals": g(
    { title: "المقترحات", purpose: "إنشاء عروض الأسعار وإرسالها ومتابعة ردود العملاء.", owner: "المبيعات، مع موافقة الإدارة حسب السياسة.", steps: ["أنشئ مقترحاً من صفقة.", "أضف البنود من المنتجات والخدمات.", "أرسله وتابع حالة القبول."] },
    { title: "Proposals", purpose: "Create quotes, send them and track client responses.", owner: "Sales, with management approval per policy.", steps: ["Create a proposal from a deal.", "Add lines from products & services.", "Send it and track acceptance."] },
  ),
  "/admin/sales/contracts": g(
    { title: "العقود", purpose: "العقود المرتبطة بالصفقات وحالة توقيعها.", owner: "المبيعات والإدارة.", steps: ["أنشئ العقد من صفقة أو قالب.", "أرسله للتوقيع.", "تابع التوقيع والانتهاء والتجديد."] },
    { title: "Contracts", purpose: "Contracts linked to deals and their signing status.", owner: "Sales and management.", steps: ["Create the contract from a deal or template.", "Send it for signature.", "Track signing, expiry and renewal."] },
  ),
  "/admin/sales/pipeline": g(
    { title: "مسار المبيعات", purpose: "عرض لوحي للصفقات والعملاء المحتملين حسب المرحلة.", owner: "فريق المبيعات ومديره.", steps: ["اسحب البطاقة لتغيير مرحلتها.", "افتح البطاقة للتفاصيل.", "راقب القيمة في كل عمود."] },
    { title: "Sales pipeline", purpose: "A board of deals and leads by stage.", owner: "The sales team and manager.", steps: ["Drag a card to change its stage.", "Open a card for details.", "Watch the value in each column."] },
  ),
  "/admin/sales/radar": g(
    { title: "رادار الصفقات", purpose: "يكشف الصفقات المعرضة للخطر (تأخر المتابعة، ركود المرحلة) ويقترح الخطوة التالية.", owner: "مديرو المبيعات ومسؤولو الصفقات.", steps: ["ابدأ بالصفقات عالية الخطورة.", "افتح الصفقة ونفّذ الإجراء المقترح.", "حدّث النشاط لتنخفض الخطورة."] },
    { title: "Deal radar", purpose: "Flags deals at risk (late follow-up, stalled stage) and suggests the next step.", owner: "Sales managers and deal owners.", steps: ["Start with high-risk deals.", "Open the deal and take the suggested action.", "Log the activity so the risk drops."] },
  ),
  "/admin/clients": g(
    { title: "الحسابات", purpose: "ملف كل عميل: جهات الاتصال والمشاريع والفواتير والتواصل.", owner: "مديرو الحسابات والمبيعات.", steps: ["افتح الحساب لرؤية الصورة الكاملة.", "حدد مدير الحساب والحالة.", "فعّل بوابة العميل لجهات الاتصال عند الحاجة."] },
    { title: "Accounts", purpose: "Each client's record: contacts, projects, invoices and communication.", owner: "Account managers and sales.", steps: ["Open an account for the full picture.", "Set the account manager and status.", "Enable client-portal access for contacts when needed."] },
  ),
  "/admin/contacts": g(
    { title: "جهات الاتصال", purpose: "الأشخاص لدى العملاء وطرق التواصل معهم.", owner: "المبيعات ومديرو الحسابات.", steps: ["أضف جهة اتصال واربطها بحساب.", "حدّث البريد والهاتف.", "راجع سجل التواصل معها."] },
    { title: "Contacts", purpose: "People at client companies and how to reach them.", owner: "Sales and account managers.", steps: ["Add a contact and link it to an account.", "Keep email and phone up to date.", "Review their communication history."] },
  ),
  "/admin/communications": g(
    { title: "سجل التواصل", purpose: "كل الرسائل والمكالمات مع العملاء في مكان واحد.", owner: "كل من يتواصل مع العملاء.", steps: ["سجّل التواصل أو راجعه.", "استخدم البحث والفلاتر.", "افتح العميل المرتبط."] },
    { title: "Communication log", purpose: "All messages and calls with clients in one place.", owner: "Everyone who talks to clients.", steps: ["Log or review communication.", "Use search and filters.", "Open the related client."] },
  ),
  "/admin/projects": g(
    { title: "المشاريع", purpose: "تنفيذ المشاريع: المراحل والمهام والملفات والساعات والتسليم.", owner: "مديرو المشاريع وفرق التنفيذ.", steps: ["افتح المشروع لمتابعة التقدم.", "وزّع المهام وحدد المواعيد.", "راجع الربحية والمخاطر."] },
    { title: "Projects", purpose: "Project delivery: milestones, tasks, files, hours and handover.", owner: "Project managers and delivery teams.", steps: ["Open a project to follow progress.", "Assign tasks and set dates.", "Review profitability and risks."] },
  ),
  "/admin/projects/tasks": g(
    { title: "المهام", purpose: "كل المهام المسندة عبر المشاريع.", owner: "فرق التنفيذ ومديروها.", steps: ["رتّب حسب الموعد أو الحالة.", "حدّث الحالة عند التقدم.", "سجّل الوقت على المهمة."] },
    { title: "Tasks", purpose: "All assigned tasks across projects.", owner: "Delivery teams and their managers.", steps: ["Sort by due date or status.", "Update the status as you progress.", "Log time on the task."] },
  ),
  "/admin/projects/time": g(
    { title: "الساعات", purpose: "ساعات العمل المسجلة على المشاريع واعتمادها.", owner: "الموظفون يسجلون، والمديرون يعتمدون.", steps: ["راجع الساعات المعلقة.", "اعتمد أو ارفض مع سبب.", "صدّر التقرير عند الحاجة."] },
    { title: "Hours", purpose: "Hours logged on projects and their approval.", owner: "Employees log, managers approve.", steps: ["Review pending hours.", "Approve or reject with a reason.", "Export the report when needed."] },
  ),
  "/admin/approvals": g(
    { title: "الموافقات", purpose: "الطلبات التي تنتظر قرارك أو قدمتها أنت.", owner: "كل من لديه طلبات أو صلاحية موافقة.", steps: ["افتح الطلب وراجع التفاصيل.", "وافق أو ارفض مع ملاحظة.", "تابع حالة طلباتك."] },
    { title: "Approvals", purpose: "Requests waiting for your decision or submitted by you.", owner: "Anyone with requests or approval rights.", steps: ["Open a request and review it.", "Approve or reject with a note.", "Follow your own requests."] },
  ),
  "/admin/finance": g(
    { title: "المالية", purpose: "الفواتير والمدفوعات والمصروفات والإيرادات والعمولات.", owner: "فريق المالية والإدارة.", steps: ["راجع المستحق والمتأخر.", "سجّل المدفوعات والمصروفات.", "استخدم الفلاتر ونطاق التاريخ للتقارير."] },
    { title: "Finance", purpose: "Invoices, payments, expenses, revenue and commissions.", owner: "Finance and management.", steps: ["Review what is due and overdue.", "Record payments and expenses.", "Use filters and the date range for reports."] },
  ),
  "/admin/team": g(
    { title: "الفريق والموارد البشرية", purpose: "بيانات الموظفين والحضور والإجازات والرواتب والتوظيف والأداء.", owner: "الموارد البشرية والمديرون؛ الموظف يرى بياناته فقط.", steps: ["اختر القسم من القائمة الجانبية.", "استخدم الفلاتر للبحث.", "التعديلات الوظيفية من صلاحية الموارد البشرية."] },
    { title: "Team & HR", purpose: "Employee records, attendance, leave, payroll, recruitment and performance.", owner: "HR and managers; employees see only their own data.", steps: ["Pick the area from the sidebar.", "Use filters to search.", "Employment changes are made by HR."] },
  ),
  "/admin/team/leave": g(
    { title: "الإجازات", purpose: "طلبات الإجازة والأرصدة والتقويم.", owner: "الموظف يطلب، والمدير والموارد البشرية يعتمدون.", steps: ["اضغط «طلب إجازة» واختر النوع والفترة.", "تابع حالة الطلب.", "راجع رصيدك قبل الطلب."] },
    { title: "Leave", purpose: "Leave requests, balances and calendar.", owner: "Employees request; managers and HR approve.", steps: ["Click “Request leave” and choose the type and period.", "Follow the request status.", "Check your balance before requesting."] },
  ),
  "/admin/team/attendance": g(
    { title: "الحضور", purpose: "سجلات الحضور والانصراف والتأخير والتصحيحات.", owner: "الموارد البشرية والمديرون.", steps: ["راجع اليوم أو فترة محددة.", "عالج طلبات التصحيح.", "صدّر التقارير."] },
    { title: "Attendance", purpose: "Clock-in/out records, lateness and corrections.", owner: "HR and managers.", steps: ["Review today or a period.", "Handle correction requests.", "Export reports."] },
  ),
  "/admin/team/payroll": g(
    { title: "الرواتب", purpose: "دورات الرواتب والقسائم والمكافآت والسلف.", owner: "الموارد البشرية تُعد، والمالية تعتمد وتصرف.", steps: ["أنشئ دورة الشهر وراجعها.", "أرسلها للاعتماد.", "اصرف وأصدر القسائم."] },
    { title: "Payroll", purpose: "Payroll runs, payslips, bonuses and advances.", owner: "HR prepares; Finance approves and pays.", steps: ["Create and review the month's run.", "Send it for approval.", "Pay and issue payslips."] },
  ),
  "/admin/team/recruitment": g(
    { title: "التوظيف", purpose: "الوظائف والمرشحون والمقابلات وعروض العمل.", owner: "الموارد البشرية ومديرو التوظيف.", steps: ["انشر وظيفة.", "حرّك المرشحين عبر مراحل المسار.", "أرسل عرض العمل ثم ابدأ التهيئة."] },
    { title: "Recruitment", purpose: "Jobs, candidates, interviews and offers.", owner: "HR and hiring managers.", steps: ["Publish a job.", "Move candidates through the pipeline.", "Send the offer, then start onboarding."] },
  ),
  "/admin/communication": g(
    { title: "التواصل", purpose: "صندوق الوارد والمحادثات الداخلية والرسائل والاجتماعات والإشعارات.", owner: "كل المستخدمين حسب الصلاحية.", steps: ["اختر القناة من القائمة.", "رد أو أنشئ رسالة جديدة.", "تابع الإشعارات غير المقروءة."] },
    { title: "Communication", purpose: "Inbox, internal chat, messaging, meetings and notifications.", owner: "All users, per permission.", steps: ["Pick the channel from the menu.", "Reply or start a new message.", "Follow unread notifications."] },
  ),
  "/admin/social": g(
    { title: "التواصل الاجتماعي", purpose: "جدولة المنشورات ونشرها ومتابعة أدائها على الحسابات المتصلة.", owner: "فريق التسويق.", steps: ["اربط الحسابات من «الحسابات المتصلة».", "أنشئ منشوراً وحدد موعده.", "راجع التحليلات بعد النشر."] },
    { title: "Social media", purpose: "Schedule, publish and track posts on connected accounts.", owner: "Marketing.", steps: ["Connect accounts under “Connected accounts”.", "Create a post and schedule it.", "Review analytics after publishing."] },
  ),
  "/admin/content": g(
    { title: "استوديو المحتوى", purpose: "تخطيط الأفكار وكتابة المحتوى ومراجعته قبل النشر.", owner: "فريق المحتوى والتسويق.", steps: ["أضف فكرة أو ولّد أفكاراً.", "حرّك العنصر عبر مراحل العمل.", "راجع «أداء المحتوى» لمعرفة ما ينجح."] },
    { title: "Content studio", purpose: "Plan ideas, write and review content before publishing.", owner: "Content and marketing.", steps: ["Add or generate ideas.", "Move items through the workflow stages.", "Check “Content performance” to see what works."] },
  ),
  "/admin/ads": g(
    { title: "الإعلانات", purpose: "قراءة أداء الحملات الإعلانية وتحليلها دون تغيير أي حملة أو ميزانية.", owner: "فريق التسويق والإدارة.", steps: ["اختر نطاق التاريخ والمنصة.", "قارن الإنفاق والنتائج.", "صدّر البيانات عند الحاجة."] },
    { title: "Ads", purpose: "Read and analyse ad performance without changing any campaign or budget.", owner: "Marketing and management.", steps: ["Pick the date range and platform.", "Compare spend and results.", "Export the data when needed."] },
  ),
  "/admin/knowledge": g(
    { title: "المعرفة", purpose: "مقالات وإجراءات وأدلة الشركة المعتمدة.", owner: "الجميع يقرأ؛ المسؤولون يكتبون ويراجعون.", steps: ["ابحث أو تصفح حسب الفئة.", "افتح المقال واتبع الخطوات.", "اقترح تعديلاً إن وجدت خطأ."] },
    { title: "Knowledge", purpose: "Approved company articles, procedures and guides.", owner: "Everyone reads; owners write and review.", steps: ["Search or browse by category.", "Open an article and follow the steps.", "Suggest an edit if something is wrong."] },
  ),
  "/admin/support": g(
    { title: "الدعم", purpose: "محادثات العملاء من كل القنوات، ووكلاء الذكاء الاصطناعي، والتذاكر، وقاعدة المعرفة.", owner: "فريق الدعم ووكلاؤه.", steps: ["رد على المحادثات في صندوق الوارد.", "حوّل المشكلات إلى تذاكر.", "راقب مهلة الاستجابة (SLA)."] },
    { title: "Support", purpose: "Client conversations from every channel, AI agents, tickets and the knowledge base.", owner: "The support team and agents.", steps: ["Reply to conversations in the inbox.", "Turn problems into tickets.", "Watch the response time (SLA)."] },
  ),
  "/admin/support/inbox": g(
    { title: "صندوق الوارد", purpose: "مكان العمل اليومي للرد على محادثات العملاء من كل القنوات.", owner: "وكلاء الدعم وقادة الفرق.", steps: ["اختر العرض من العمود الأول (المسندة لي، غير المسندة، الحالة).", "افتح المحادثة ورد من تبويب «رد» أو اكتب «ملاحظة» داخلية.", "من لوحة العميل غيّر المسؤول والفريق والأولوية، ومن «⋯» أنشئ تذكرة أو انقلها للرسائل المزعجة."] },
    { title: "Inbox", purpose: "The daily workspace for replying to customer conversations from every channel.", owner: "Support agents and team leads.", steps: ["Pick a view in the first column (mine, unassigned, status).", "Open a conversation and reply in “Reply”, or write an internal “Note”.", "Use the customer panel for assignee, team and priority; use “⋯” to create a ticket or move it to spam."] },
  ),
  "/admin/support/spam": g(
    { title: "الرسائل المزعجة", purpose: "المحادثات المصنفة كرسائل مزعجة، بعيداً عن صندوق الوارد والتقارير.", owner: "وكلاء الدعم.", steps: ["راجع المحادثة قبل القرار.", "اضغط «ليست رسالة مزعجة — استعادة» لإعادتها بحالتها السابقة.", "الرسائل الجديدة من نفس العميل تصل هنا تلقائياً دون تنبيهات."] },
    { title: "Spam", purpose: "Conversations flagged as spam, kept out of the inbox and the reports.", owner: "Support agents.", steps: ["Review the conversation before deciding.", "Click “Not spam — restore” to return it with its previous status.", "New messages from the same customer land here automatically, without alerts."] },
  ),
  "/admin/support/ai-agents": g(
    { title: "وكيل الذكاء الاصطناعي", purpose: "يرد على زوار الموقع من مقالات قاعدة المعرفة المسموح بها ويحوّل لموظف عند الحاجة.", owner: "مدير الدعم.", steps: ["تأكد أن مزود الذكاء الاصطناعي متصل من مركز التكاملات.", "اضبط الأسلوب وحدود التحويل ومصادر المعرفة.", "جرّب الوكيل، ثم اربطه بويدجت الموقع."] },
    { title: "AI agent", purpose: "Answers website visitors from permitted knowledge-base articles and hands off to a person when needed.", owner: "The support manager.", steps: ["Make sure an AI provider is connected in the Integrations hub.", "Set the tone, hand-off limits and knowledge sources.", "Test the agent, then attach it to a website widget."] },
  ),
  "/admin/support/tickets": g(
    { title: "التذاكر", purpose: "طلبات الدعم التي تحتاج متابعة بمهلة (SLA) وحالة وأولوية ومسؤول.", owner: "فريق الدعم.", steps: ["استخدم شرائح الحالة والفلاتر.", "افتح التذكرة لتحديث الحالة والرد.", "التذاكر المنشأة من محادثة ترتبط بها في الاتجاهين."] },
    { title: "Tickets", purpose: "Support requests tracked with an SLA, status, priority and owner.", owner: "The support team.", steps: ["Use the status chips and filters.", "Open a ticket to update its status and reply.", "Tickets created from a conversation stay linked both ways."] },
  ),
  "/admin/support/knowledge": g(
    { title: "قاعدة المعرفة", purpose: "مقالات المساعدة والأسئلة الشائعة للعملاء، ومصدر إجابات الوكيل الذكي.", owner: "فريق الدعم والمحتوى.", steps: ["أنشئ «مقال مساعدة» (جمهوره عام).", "انشره بعد المعاينة.", "فعّل «للوكيل الذكي» ليستخدمه في الردود."] },
    { title: "Knowledge base", purpose: "Customer help articles and FAQs, and the AI agent's source of answers.", owner: "Support and content team.", steps: ["Create a “help article” (public audience).", "Publish it after previewing.", "Enable “For the AI agent” so it is used in replies."] },
  ),
  "/admin/settings/integrations/widgets": g(
    { title: "ويدجت الموقع", purpose: "أدوات تضعها في موقعك: نافذة محادثة الدعم وزر واتساب.", owner: "مدير الدعم ومسؤول الرسائل.", steps: ["أنشئ الويدجت وأضف نطاق موقعك.", "انسخ كود التضمين إلى صفحات الموقع.", "اربطه بفريق ووكيل ذكاء اصطناعي عند الحاجة."] },
    { title: "Website widgets", purpose: "Tools you place on your website: the support chat window and the WhatsApp button.", owner: "Support manager and messaging owner.", steps: ["Create the widget and add your site's domain.", "Copy the embed code into your pages.", "Attach a team and an AI agent if needed."] },
  ),
  "/admin/reports": g(
    { title: "التقارير", purpose: "تقارير وتحليلات على مستوى الشركة من بيانات الموديولات الفعلية.", owner: "الإدارة ومن لديه صلاحية التقارير.", steps: ["اختر التقرير من القائمة.", "حدد نطاق التاريخ والفلاتر.", "صدّر أو اطبع النتيجة."] },
    { title: "Reports", purpose: "Company-level reports and analytics from live module data.", owner: "Management and whoever has report access.", steps: ["Pick a report from the menu.", "Set the date range and filters.", "Export or print the result."] },
  ),
  "/admin/automation": g(
    { title: "الأتمتة", purpose: "قواعد ومسارات تنفذ إجراءات تلقائياً عند أحداث معينة.", owner: "الإدارة.", steps: ["أنشئ قاعدة بشرط وإجراء.", "فعّلها وجرّبها.", "راجع سجل الأحداث للتأكد من التنفيذ."] },
    { title: "Automation", purpose: "Rules and workflows that act automatically on events.", owner: "Management.", steps: ["Create a rule with a condition and an action.", "Enable and test it.", "Check the event log to confirm it ran."] },
  ),
  "/admin/files": g(
    { title: "الملفات", purpose: "ملفات الشركة والمشاريع والملفات المشتركة والقوالب.", owner: "كل المستخدمين حسب الصلاحية.", steps: ["ارفع الملف واربطه بسجل.", "شارك الملف مع الفريق أو العميل.", "اجعل الملف قالباً لإعادة استخدامه."] },
    { title: "Files", purpose: "Company, project and shared files and templates.", owner: "All users, per permission.", steps: ["Upload a file and link it to a record.", "Share it with the team or a client.", "Make it a template to reuse it."] },
  ),
  "/admin/documents": g(
    { title: "المستندات والقوالب", purpose: "توليد المستندات من القوالب وإرسالها للتوقيع.", owner: "الإدارة والفرق المخوّلة.", steps: ["اختر قالباً وأنشئ المستند.", "راجع المعاينة.", "أرسله للتوقيع وتابع الحالة."] },
    { title: "Documents & templates", purpose: "Generate documents from templates and send them for signature.", owner: "Management and authorised teams.", steps: ["Pick a template and create the document.", "Review the preview.", "Send it for signature and track it."] },
  ),
  "/admin/settings": g(
    { title: "الإعدادات", purpose: "مركز تكوين النظام: الشركة والمستخدمون والصلاحيات والتكاملات وإعدادات الموديولات.", owner: "مسؤولو النظام ومن فُوّض لهم.", steps: ["اختر القسم من القائمة الجانبية.", "عدّل واحفظ — كل تغيير يُسجّل في سجل التدقيق.", "العمليات اليومية تبقى داخل موديولاتها."] },
    { title: "Settings", purpose: "The configuration hub: company, users, permissions, integrations and module settings.", owner: "System administrators and delegates.", steps: ["Pick the section from the sidebar.", "Edit and save — every change is audited.", "Day-to-day work stays in its module."] },
  ),
  "/admin/settings/company": g(
    { title: "إعدادات الشركة", purpose: "بيانات الشركة والهوية والألوان والإقليمية والعملات وقواعد المبيعات والسياسات.", owner: "مسؤول النظام؛ المالية تدير العملات وقواعد العمولة.", steps: ["حدّث البيانات والهوية.", "اضبط العملة والمنطقة الزمنية.", "راجع قواعد المبيعات والعمولة والموافقات."] },
    { title: "Company settings", purpose: "Company details, branding, colours, regional settings, currencies, sales rules and policies.", owner: "System admin; Finance manages currencies and commission rules.", steps: ["Update details and branding.", "Set the currency and timezone.", "Review sales, commission and approval rules."] },
  ),
  "/admin/settings/integrations": g(
    { title: "مركز التكاملات", purpose: "ربط الخدمات الخارجية (البريد، واتساب، الدفع، الذكاء الاصطناعي...) وإدارة مفاتيحها بأمان.", owner: "مسؤول التكاملات.", steps: ["اختر الخدمة واضغط «ربط».", "أدخل المفاتيح — تُحفظ مشفرة ولا تُعرض مرة أخرى.", "اختبر الاتصال وتأكد أن الحالة «متصل»."] },
    { title: "Integrations hub", purpose: "Connect external services (email, WhatsApp, payments, AI…) and manage their keys securely.", owner: "The integrations administrator.", steps: ["Pick a service and click “Connect”.", "Enter the keys — they are stored encrypted and never shown again.", "Test the connection and make sure it shows “Connected”."] },
  ),
  "/admin/profile": g(
    { title: "ملفي", purpose: "بياناتك الوظيفية للعرض وإعدادات أمان حسابك.", owner: "أنت؛ التعديلات الوظيفية من الموارد البشرية.", steps: ["راجع بياناتك.", "فعّل تطبيق المصادقة من تبويب «الأمان».", "لتغيير كلمة المرور اطلب رابطاً من المسؤول."] },
    { title: "My profile", purpose: "Your employment details (read-only) and account security.", owner: "You; employment changes are made by HR.", steps: ["Review your details.", "Enable the authenticator app in the “Security” tab.", "To change your password, ask an admin for a reset link."] },
  ),
};

export function guideFor(pathname: string): PageGuide | null {
  let best: string | null = null;
  for (const k of Object.keys(pageGuides)) {
    if ((pathname === k || pathname.startsWith(`${k}/`)) && (!best || k.length > best.length)) best = k;
  }
  return best ? pageGuides[best] : null;
}
