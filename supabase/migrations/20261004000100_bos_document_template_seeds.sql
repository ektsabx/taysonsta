-- Master upgrade Phase 5: default system templates (Arabic + English) for
-- every document type in docs/bos/30 §8.1. Editable from Documents →
-- Templates (each edit = a new version). Only variables the resolvers in
-- services/bos/documents.ts provide are used; empty values print as blank —
-- nothing is invented (e.g. no fake registration numbers).

create or replace function pg_temp.seed_template(p_key text, p_name text, p_type text, p_lang text, p_module text, p_subject text, p_body text)
returns void language plpgsql as $$
declare v_t uuid; v_v uuid;
begin
  if exists (select 1 from document_templates where key = p_key) then return; end if;
  insert into document_templates (key, name, doc_type, language, module, is_system)
  values (p_key, p_name, p_type, p_lang, p_module, true) returning id into v_t;
  insert into document_template_versions (template_id, version, subject, body, change_note)
  values (v_t, 1, p_subject, p_body, 'Initial system template') returning id into v_v;
  update document_templates set current_version_id = v_v where id = v_t;
end $$;

-- ---------------------------------------------------------------- invoice
select pg_temp.seed_template('invoice_ar', 'فاتورة', 'invoice', 'ar', 'finance', null, $t$# فاتورة {{invoice.number}}

**تاريخ الإصدار:** {{date invoice.issue_date}}{{#if invoice.due_date}} · **تاريخ الاستحقاق:** {{date invoice.due_date}}{{/if}}

## بيانات العميل
**{{client.display_name}}**{{#if client.address}}
{{client.address}}{{/if}}{{#if client.city}}
{{client.city}} — {{client.country}}{{/if}}{{#if client.tax_id}}
الرقم الضريبي: {{client.tax_id}}{{/if}}

## البنود
| # | الوصف | الكمية | سعر الوحدة | الإجمالي |
|---|---|---|---|---|
{{#each lines}}| {{@index}} | {{description}} | {{quantity}} | {{money unit_price currency}} | {{money line_total currency}} |
{{/each}}

| | |
|---|---|
| المجموع الفرعي | {{money invoice.subtotal invoice.currency}} |
{{#if invoice.discount_amount}}| الخصم | {{money invoice.discount_amount invoice.currency}} |
{{/if}}{{#if invoice.tax_amount}}| الضريبة ({{invoice.tax_rate}}%) | {{money invoice.tax_amount invoice.currency}} |
{{/if}}| **الإجمالي** | **{{money invoice.total invoice.currency}}** |
{{#if invoice.amount_paid}}| المدفوع | {{money invoice.amount_paid invoice.currency}} |
| **المتبقي** | **{{money invoice.balance invoice.currency}}** |
{{/if}}
{{#if invoice.payment_terms}}
## شروط الدفع
{{invoice.payment_terms}}
{{/if}}{{#if invoice.notes}}
## ملاحظات
{{invoice.notes}}
{{/if}}
$t$);

select pg_temp.seed_template('invoice_en', 'Invoice', 'invoice', 'en', 'finance', null, $t$# Invoice {{invoice.number}}

**Issue date:** {{date invoice.issue_date}}{{#if invoice.due_date}} · **Due date:** {{date invoice.due_date}}{{/if}}

## Bill to
**{{client.display_name}}**{{#if client.address}}
{{client.address}}{{/if}}{{#if client.city}}
{{client.city}} — {{client.country}}{{/if}}{{#if client.tax_id}}
Tax ID: {{client.tax_id}}{{/if}}

## Items
| # | Description | Qty | Unit price | Total |
|---|---|---|---|---|
{{#each lines}}| {{@index}} | {{description}} | {{quantity}} | {{money unit_price currency}} | {{money line_total currency}} |
{{/each}}

| | |
|---|---|
| Subtotal | {{money invoice.subtotal invoice.currency}} |
{{#if invoice.discount_amount}}| Discount | {{money invoice.discount_amount invoice.currency}} |
{{/if}}{{#if invoice.tax_amount}}| Tax ({{invoice.tax_rate}}%) | {{money invoice.tax_amount invoice.currency}} |
{{/if}}| **Total** | **{{money invoice.total invoice.currency}}** |
{{#if invoice.amount_paid}}| Paid | {{money invoice.amount_paid invoice.currency}} |
| **Balance due** | **{{money invoice.balance invoice.currency}}** |
{{/if}}
{{#if invoice.payment_terms}}
## Payment terms
{{invoice.payment_terms}}
{{/if}}{{#if invoice.notes}}
## Notes
{{invoice.notes}}
{{/if}}
$t$);

-- ---------------------------------------------------------------- client contract
select pg_temp.seed_template('client_contract_ar', 'عقد تقديم خدمات', 'client_contract', 'ar', 'sales', null, $t$# {{contract.title}}

**رقم العقد:** {{contract.number}} · **التاريخ:** {{date today}}

أُبرم هذا العقد بين:

1. **{{company.legal_name}}**{{#if company.commercial_registration}} (سجل تجاري رقم {{company.commercial_registration}}){{/if}}، ومقرها {{company.address}}، ويُشار إليها بـ«مقدم الخدمة».
2. **{{client.display_name}}**{{#if client.address}}، وعنوانه {{client.address}}{{/if}}، ويُشار إليه بـ«العميل».

## أولاً: موضوع العقد
يلتزم مقدم الخدمة بتنفيذ الأعمال الموضحة أدناه{{#if project.name}} ضمن مشروع «{{project.name}}»{{/if}}.

{{#if scope}}{{scope}}{{else}}يُحدد نطاق العمل في المقترح المعتمد المرفق بهذا العقد.{{/if}}

## ثانياً: القيمة والدفع
قيمة العقد **{{money contract.value contract.currency}}**.
{{#if contract.payment_terms}}
{{contract.payment_terms}}{{/if}}

## ثالثاً: المدة
{{#if contract.start_date}}يبدأ العقد في {{date contract.start_date}}{{/if}}{{#if contract.end_date}} وينتهي في {{date contract.end_date}}{{/if}}.

## رابعاً: السرية والملكية الفكرية
يلتزم الطرفان بالحفاظ على سرية المعلومات المتبادلة. تنتقل ملكية المخرجات النهائية للعميل بعد سداد كامل المستحقات، ما لم يُتفق على غير ذلك كتابةً.

## خامساً: أحكام عامة
أي تعديل على هذا العقد يكون كتابةً وبموافقة الطرفين. يخضع العقد للقوانين المعمول بها في بلد مقدم الخدمة.

[[signatures: عن مقدم الخدمة: {{company.legal_name}} | عن العميل: {{client.display_name}}]]
$t$);

select pg_temp.seed_template('client_contract_en', 'Service Agreement', 'client_contract', 'en', 'sales', null, $t$# {{contract.title}}

**Contract no.:** {{contract.number}} · **Date:** {{date today}}

This agreement is made between:

1. **{{company.legal_name}}**{{#if company.commercial_registration}} (Commercial Registration {{company.commercial_registration}}){{/if}}, located at {{company.address}} (the "Provider"); and
2. **{{client.display_name}}**{{#if client.address}}, located at {{client.address}}{{/if}} (the "Client").

## 1. Subject
The Provider shall deliver the work described below{{#if project.name}} under the project "{{project.name}}"{{/if}}.

{{#if scope}}{{scope}}{{else}}The scope of work is defined in the approved proposal attached to this agreement.{{/if}}

## 2. Fees and payment
The contract value is **{{money contract.value contract.currency}}**.
{{#if contract.payment_terms}}
{{contract.payment_terms}}{{/if}}

## 3. Term
{{#if contract.start_date}}This agreement starts on {{date contract.start_date}}{{/if}}{{#if contract.end_date}} and ends on {{date contract.end_date}}{{/if}}.

## 4. Confidentiality and intellectual property
Both parties keep exchanged information confidential. Ownership of the final deliverables passes to the Client once all fees are paid, unless agreed otherwise in writing.

## 5. General
Any amendment must be in writing and agreed by both parties. This agreement is governed by the laws of the Provider's country.

[[signatures: For the Provider: {{company.legal_name}} | For the Client: {{client.display_name}}]]
$t$);

-- ---------------------------------------------------------------- proposal / quotation
select pg_temp.seed_template('proposal_ar', 'عرض سعر', 'proposal', 'ar', 'sales', null, $t$# عرض سعر — {{deal.name}}

**المرجع:** {{deal.number}} · **التاريخ:** {{date today}}{{#if proposal.valid_until}} · **صالح حتى:** {{date proposal.valid_until}}{{/if}}

**مقدم إلى:** {{client.display_name}}

{{#if lines}}
## البنود
| # | البند | الكمية | السعر | الإجمالي |
|---|---|---|---|---|
{{#each lines}}| {{@index}} | {{name}} | {{quantity}} | {{money unit_price currency}} | {{money line_total currency}} |
{{/each}}{{/if}}

**الإجمالي: {{money deal.value deal.currency}}**

{{#if payment_terms}}
## جدول الدفعات
| الدفعة | النسبة |
|---|---|
{{#each payment_terms}}| {{label}} | {{percent}}% |
{{/each}}{{/if}}
{{#if proposal.assumptions}}
## الافتراضات
{{proposal.assumptions}}
{{/if}}{{#if proposal.terms}}
## الشروط
{{proposal.terms}}
{{/if}}
$t$);

select pg_temp.seed_template('proposal_en', 'Quotation', 'proposal', 'en', 'sales', null, $t$# Quotation — {{deal.name}}

**Reference:** {{deal.number}} · **Date:** {{date today}}{{#if proposal.valid_until}} · **Valid until:** {{date proposal.valid_until}}{{/if}}

**Prepared for:** {{client.display_name}}

{{#if lines}}
## Items
| # | Item | Qty | Price | Total |
|---|---|---|---|---|
{{#each lines}}| {{@index}} | {{name}} | {{quantity}} | {{money unit_price currency}} | {{money line_total currency}} |
{{/each}}{{/if}}

**Total: {{money deal.value deal.currency}}**

{{#if payment_terms}}
## Payment schedule
| Instalment | Percent |
|---|---|
{{#each payment_terms}}| {{label}} | {{percent}}% |
{{/each}}{{/if}}
{{#if proposal.assumptions}}
## Assumptions
{{proposal.assumptions}}
{{/if}}{{#if proposal.terms}}
## Terms
{{proposal.terms}}
{{/if}}
$t$);

-- ---------------------------------------------------------------- job offer
select pg_temp.seed_template('job_offer_ar', 'عرض عمل', 'job_offer', 'ar', 'hr', null, $t$# عرض عمل

**الرقم:** {{offer.number}} · **التاريخ:** {{date today}}

السيد/السيدة **{{candidate.full_name}}**،

يسعدنا في {{company.name}} أن نعرض عليك وظيفة **{{offer.position_title}}**{{#if department.name}} في قسم {{department.name}}{{/if}}، وفق الشروط التالية:

| البند | التفاصيل |
|---|---|
| تاريخ بدء العمل | {{date offer.start_date}} |
| نوع التوظيف | {{offer.employment_type_label}} |
| الراتب الأساسي الشهري | {{money offer.basic_salary offer.currency}} |
{{#each allowances}}| {{name}} | {{money amount ../currency}} |
{{/each}}| فترة الاختبار | {{offer.probation_months}} أشهر |
{{#if manager.name}}| المدير المباشر | {{manager.name}} |
{{/if}}
{{#if offer.expires_at}}هذا العرض صالح حتى {{date offer.expires_at}}.{{/if}} يخضع التعيين لاستكمال المستندات المطلوبة وتوقيع عقد العمل.

[[signatures: عن الشركة: {{company.name}} | قبول المرشح: {{candidate.full_name}}]]
$t$);

select pg_temp.seed_template('job_offer_en', 'Job Offer', 'job_offer', 'en', 'hr', null, $t$# Job Offer

**No.:** {{offer.number}} · **Date:** {{date today}}

Dear **{{candidate.full_name}}**,

{{company.name}} is pleased to offer you the position of **{{offer.position_title}}**{{#if department.name}} in the {{department.name}} department{{/if}}, on the following terms:

| Term | Details |
|---|---|
| Start date | {{date offer.start_date}} |
| Employment type | {{offer.employment_type_label}} |
| Monthly basic salary | {{money offer.basic_salary offer.currency}} |
{{#each allowances}}| {{name}} | {{money amount ../currency}} |
{{/each}}| Probation | {{offer.probation_months}} months |
{{#if manager.name}}| Reports to | {{manager.name}} |
{{/if}}
{{#if offer.expires_at}}This offer is valid until {{date offer.expires_at}}.{{/if}} Employment is subject to completing the required documents and signing the employment contract.

[[signatures: For the company: {{company.name}} | Accepted by: {{candidate.full_name}}]]
$t$);

-- ---------------------------------------------------------------- employment contract
select pg_temp.seed_template('employment_contract_ar', 'عقد عمل', 'employment_contract', 'ar', 'hr', null, $t$# عقد عمل

**رقم العقد:** {{contract.number}} · **التاريخ:** {{date today}}

أُبرم هذا العقد بين **{{company.legal_name}}** («صاحب العمل») و**{{employee.full_name}}** («الموظف»){{#if employee.national_id}}، رقم الهوية {{employee.national_id}}{{/if}}.

## أولاً: الوظيفة
يعمل الموظف بوظيفة **{{contract.position_title}}**{{#if employee.department}} في قسم {{employee.department}}{{/if}}، اعتباراً من {{date contract.start_date}}{{#if contract.end_date}} وحتى {{date contract.end_date}}{{/if}}.

## ثانياً: الأجر
الراتب الأساسي الشهري **{{money contract.basic_salary contract.currency}}**، ويُصرف وفق نظام الرواتب المعتمد لدى صاحب العمل.

## ثالثاً: ساعات العمل والإجازات
وفق جدول العمل ولائحة الإجازات المعتمدة لدى صاحب العمل.

## رابعاً: فترة الإخطار
{{#if contract.notice_period_days}}يلتزم أي من الطرفين بإخطار الآخر كتابةً قبل {{contract.notice_period_days}} يوماً من إنهاء العقد.{{else}}وفق القانون المعمول به.{{/if}}

## خامساً: السرية
يلتزم الموظف بالحفاظ على سرية معلومات صاحب العمل وعملائه أثناء العمل وبعد انتهائه.
{{#if contract.terms}}
## شروط إضافية
{{contract.terms}}
{{/if}}
[[signatures: عن صاحب العمل: {{company.legal_name}} | الموظف: {{employee.full_name}}]]
$t$);

select pg_temp.seed_template('employment_contract_en', 'Employment Contract', 'employment_contract', 'en', 'hr', null, $t$# Employment Contract

**Contract no.:** {{contract.number}} · **Date:** {{date today}}

This contract is made between **{{company.legal_name}}** (the "Employer") and **{{employee.full_name}}** (the "Employee"){{#if employee.national_id}}, ID number {{employee.national_id}}{{/if}}.

## 1. Position
The Employee is employed as **{{contract.position_title}}**{{#if employee.department}} in the {{employee.department}} department{{/if}}, starting {{date contract.start_date}}{{#if contract.end_date}} until {{date contract.end_date}}{{/if}}.

## 2. Salary
The monthly basic salary is **{{money contract.basic_salary contract.currency}}**, paid under the Employer's payroll policy.

## 3. Working hours and leave
According to the Employer's work schedule and leave policy.

## 4. Notice
{{#if contract.notice_period_days}}Either party shall give {{contract.notice_period_days}} days' written notice to end this contract.{{else}}According to applicable law.{{/if}}

## 5. Confidentiality
The Employee shall keep the Employer's and its clients' information confidential during and after employment.
{{#if contract.terms}}
## Additional terms
{{contract.terms}}
{{/if}}
[[signatures: For the Employer: {{company.legal_name}} | Employee: {{employee.full_name}}]]
$t$);

-- ---------------------------------------------------------------- NDA & IP
select pg_temp.seed_template('nda_ip_ar', 'اتفاقية السرية والملكية الفكرية', 'nda_ip', 'ar', 'legal', null, $t$# اتفاقية السرية والملكية الفكرية

**التاريخ:** {{date today}}

بين **{{company.legal_name}}** و**{{party.name}}**.

## أولاً: المعلومات السرية
تشمل كل المعلومات التجارية والفنية والمالية وبيانات العملاء التي يطّلع عليها الطرف الآخر بأي وسيلة.

## ثانياً: الالتزامات
عدم الإفصاح عن المعلومات السرية أو استخدامها لغير الغرض المتفق عليه، وإعادتها أو إتلافها عند الطلب.

## ثالثاً: الملكية الفكرية
كل ما يُنتج في إطار العمل مع الشركة من تصاميم وبرمجيات ومستندات يكون ملكاً للشركة، ما لم يُتفق على غير ذلك كتابةً.

## رابعاً: المدة
تسري الالتزامات أثناء العلاقة ولمدة ثلاث سنوات بعد انتهائها، وتبقى حقوق الملكية الفكرية دون حد زمني.

[[signatures: عن الشركة: {{company.legal_name}} | {{party.name}}]]
$t$);

select pg_temp.seed_template('nda_ip_en', 'Confidentiality & IP Agreement', 'nda_ip', 'en', 'legal', null, $t$# Confidentiality & Intellectual Property Agreement

**Date:** {{date today}}

Between **{{company.legal_name}}** and **{{party.name}}**.

## 1. Confidential information
All business, technical and financial information and client data disclosed by any means.

## 2. Obligations
Not to disclose confidential information or use it beyond the agreed purpose, and to return or destroy it on request.

## 3. Intellectual property
Everything produced in the course of work with the company — designs, software, documents — belongs to the company unless agreed otherwise in writing.

## 4. Term
Obligations apply during the relationship and for three years after it ends; intellectual property rights have no time limit.

[[signatures: For the company: {{company.legal_name}} | {{party.name}}]]
$t$);

-- ---------------------------------------------------------------- maintenance & support
select pg_temp.seed_template('maintenance_agreement_ar', 'اتفاقية صيانة ودعم', 'maintenance_agreement', 'ar', 'projects', null, $t$# اتفاقية صيانة ودعم فني

**المشروع:** {{project.name}} ({{project.number}}) · **التاريخ:** {{date today}}

بين **{{company.legal_name}}** و**{{client.display_name}}**.

## نطاق الدعم
- إصلاح الأخطاء البرمجية في المخرجات المسلّمة.
- الرد على الاستفسارات الفنية عبر بوابة العملاء.
- التحديثات الأمنية الضرورية.

## المدة
{{#if project.support_until}}تسري حتى {{date project.support_until}}.{{else}}تُحدد مدة الدعم باتفاق مكتوب.{{/if}}

## أوقات الاستجابة
وفق سياسة مستوى الخدمة (SLA) المعتمدة لدى الشركة وأولوية كل طلب.

## خارج النطاق
الميزات الجديدة أو التعديلات الجوهرية تُعامل كطلبات تغيير بتسعير مستقل.

[[signatures: عن الشركة: {{company.legal_name}} | عن العميل: {{client.display_name}}]]
$t$);

select pg_temp.seed_template('maintenance_agreement_en', 'Maintenance & Support Agreement', 'maintenance_agreement', 'en', 'projects', null, $t$# Maintenance & Support Agreement

**Project:** {{project.name}} ({{project.number}}) · **Date:** {{date today}}

Between **{{company.legal_name}}** and **{{client.display_name}}**.

## Support scope
- Fixing defects in the delivered work.
- Answering technical questions through the client portal.
- Necessary security updates.

## Term
{{#if project.support_until}}Valid until {{date project.support_until}}.{{else}}The support term is set by written agreement.{{/if}}

## Response times
According to the company's service-level policy (SLA) and each request's priority.

## Out of scope
New features or substantial changes are handled as change requests, priced separately.

[[signatures: For the company: {{company.legal_name}} | For the client: {{client.display_name}}]]
$t$);

-- ---------------------------------------------------------------- license certificate
select pg_temp.seed_template('license_certificate_ar', 'شهادة ترخيص', 'license_certificate', 'ar', 'projects', null, $t$# شهادة ترخيص استخدام

**رقم الشهادة:** {{doc.number}} · **التاريخ:** {{date today}}

تشهد **{{company.legal_name}}** بأن **{{client.display_name}}** مرخّص له باستخدام مخرجات مشروع **{{project.name}}** ({{project.number}}) للأغراض التجارية الخاصة به{{#if project.completed_at}}، اعتباراً من {{date project.completed_at}}{{/if}}.

لا يشمل الترخيص إعادة البيع أو إعادة الترخيص لطرف ثالث دون موافقة كتابية.

[[signatures: عن الشركة: {{company.legal_name}}]]
$t$);

select pg_temp.seed_template('license_certificate_en', 'License Certificate', 'license_certificate', 'en', 'projects', null, $t$# Licence Certificate

**Certificate no.:** {{doc.number}} · **Date:** {{date today}}

**{{company.legal_name}}** certifies that **{{client.display_name}}** is licensed to use the deliverables of the project **{{project.name}}** ({{project.number}}) for its own business purposes{{#if project.completed_at}}, effective {{date project.completed_at}}{{/if}}.

The licence does not include resale or sublicensing to third parties without written consent.

[[signatures: For the company: {{company.legal_name}}]]
$t$);

-- ---------------------------------------------------------------- handover / acceptance
select pg_temp.seed_template('handover_certificate_ar', 'محضر تسليم واستلام', 'handover_certificate', 'ar', 'projects', null, $t$# محضر تسليم واستلام

**المشروع:** {{project.name}} ({{project.number}}) · **التاريخ:** {{date today}}

يقر **{{client.display_name}}** باستلام مخرجات المشروع التالية من **{{company.legal_name}}**:

{{#if milestones}}| المرحلة | الحالة | تاريخ الإنجاز |
|---|---|---|
{{#each milestones}}| {{name}} | {{status_label}} | {{date completed_at}} |
{{/each}}{{else}}- المخرجات المحددة في نطاق العمل المعتمد.{{/if}}

وبذلك تبدأ فترة الدعم{{#if project.support_until}} حتى {{date project.support_until}}{{/if}}.

**ملاحظات العميل:**

---

[[signatures: المسلِّم: {{company.legal_name}} | المستلِم: {{client.display_name}}]]
$t$);

select pg_temp.seed_template('handover_certificate_en', 'Handover & Acceptance Certificate', 'handover_certificate', 'en', 'projects', null, $t$# Handover & Acceptance Certificate

**Project:** {{project.name}} ({{project.number}}) · **Date:** {{date today}}

**{{client.display_name}}** acknowledges receiving the following project deliverables from **{{company.legal_name}}**:

{{#if milestones}}| Milestone | Status | Completed |
|---|---|---|
{{#each milestones}}| {{name}} | {{status_label}} | {{date completed_at}} |
{{/each}}{{else}}- The deliverables defined in the approved scope.{{/if}}

The support period starts now{{#if project.support_until}} and runs until {{date project.support_until}}{{/if}}.

**Client notes:**

---

[[signatures: Delivered by: {{company.legal_name}} | Received by: {{client.display_name}}]]
$t$);

-- ---------------------------------------------------------------- HR documents
select pg_temp.seed_template('salary_certificate_ar', 'شهادة راتب', 'hr_document', 'ar', 'hr', null, $t$# شهادة راتب

**التاريخ:** {{date today}}

تشهد **{{company.legal_name}}** بأن السيد/السيدة **{{employee.full_name}}** يعمل لديها بوظيفة **{{employee.position}}** منذ {{date employee.start_date}}، ويتقاضى راتباً أساسياً شهرياً قدره **{{money salary.basic salary.currency}}**{{#if salary.total}}، وإجمالي شهري قدره **{{money salary.total salary.currency}}**{{/if}}.

أُعطيت هذه الشهادة بناءً على طلبه دون أدنى مسؤولية على الشركة.

[[signatures: الموارد البشرية — {{company.legal_name}}]]
$t$);

select pg_temp.seed_template('salary_certificate_en', 'Salary Certificate', 'hr_document', 'en', 'hr', null, $t$# Salary Certificate

**Date:** {{date today}}

**{{company.legal_name}}** certifies that **{{employee.full_name}}** has been employed as **{{employee.position}}** since {{date employee.start_date}}, with a monthly basic salary of **{{money salary.basic salary.currency}}**{{#if salary.total}} and a total monthly package of **{{money salary.total salary.currency}}**{{/if}}.

This certificate is issued at the employee's request without any liability on the company.

[[signatures: Human Resources — {{company.legal_name}}]]
$t$);

select pg_temp.seed_template('experience_certificate_ar', 'شهادة خبرة', 'hr_document', 'ar', 'hr', null, $t$# شهادة خبرة

**التاريخ:** {{date today}}

تشهد **{{company.legal_name}}** بأن السيد/السيدة **{{employee.full_name}}** عمل لديها بوظيفة **{{employee.position}}** في الفترة من {{date employee.start_date}}{{#if employee.end_date}} حتى {{date employee.end_date}}{{else}} وحتى تاريخه{{/if}}.

نتمنى له التوفيق.

[[signatures: الموارد البشرية — {{company.legal_name}}]]
$t$);

select pg_temp.seed_template('experience_certificate_en', 'Experience Certificate', 'hr_document', 'en', 'hr', null, $t$# Experience Certificate

**Date:** {{date today}}

**{{company.legal_name}}** certifies that **{{employee.full_name}}** worked as **{{employee.position}}** from {{date employee.start_date}}{{#if employee.end_date}} until {{date employee.end_date}}{{else}} to date{{/if}}.

We wish them every success.

[[signatures: Human Resources — {{company.legal_name}}]]
$t$);

-- ---------------------------------------------------------------- email templates
select pg_temp.seed_template('email_invoice_sent_ar', 'بريد: إرسال فاتورة', 'email', 'ar', 'finance', 'فاتورة {{invoice.number}} من {{company.name}}', $t$مرحباً {{client.display_name}}،

نرفق لكم الفاتورة **{{invoice.number}}** بقيمة **{{money invoice.total invoice.currency}}**{{#if invoice.due_date}}، وتاريخ استحقاقها {{date invoice.due_date}}{{/if}}.

يمكنكم متابعة الفواتير والدفعات من بوابة العملاء.

مع التحية،
{{company.name}}
$t$);

select pg_temp.seed_template('email_invoice_sent_en', 'Email: invoice sent', 'email', 'en', 'finance', 'Invoice {{invoice.number}} from {{company.name}}', $t$Hello {{client.display_name}},

Please find attached invoice **{{invoice.number}}** for **{{money invoice.total invoice.currency}}**{{#if invoice.due_date}}, due on {{date invoice.due_date}}{{/if}}.

You can follow invoices and payments in the client portal.

Best regards,
{{company.name}}
$t$);

select pg_temp.seed_template('email_document_ar', 'بريد: إرسال مستند', 'email', 'ar', 'general', '{{doc.title}} — {{company.name}}', $t$مرحباً،

نرفق لكم المستند **{{doc.title}}** (رقم {{doc.number}}).

مع التحية،
{{company.name}}
$t$);

select pg_temp.seed_template('email_document_en', 'Email: document', 'email', 'en', 'general', '{{doc.title}} — {{company.name}}', $t$Hello,

Please find attached the document **{{doc.title}}** (no. {{doc.number}}).

Best regards,
{{company.name}}
$t$);
