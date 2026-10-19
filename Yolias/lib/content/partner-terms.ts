import type { Block, Localized } from "./types";

// Yolias Partner Program terms (/partners/terms, owner brief 2026-10-19).
// Numbers in {braces} are filled from the live program settings (Yolias
// Admin → Affiliates → Program settings), so this page never disagrees with
// the program. The program version a partner accepted is shown on the page.

export const PARTNER_TERMS_UPDATED = "2026-10-19";

export const partnerTerms: Localized<{ title: string; seoTitle: string; summary: string; version: string; blocks: Block[] }> = {
  en: {
    title: "Yolias Partner Program terms",
    seoTitle: "Partner Program Terms | Yolias",
    summary: "How the Yolias affiliate program works: joining, referral links, commissions, waiting period, payouts, promotion rules and how the program can change.",
    version: "Program version {version}",
    blocks: [
      { h2: "1. The program" },
      { p: "The Yolias Partner Program (“the program”) is run by Yolias LLC. It lets you earn a commission when customers you refer pay for a Yolias plan. These terms apply together with the [Terms of Service](/legal/terms) and the [Privacy Policy](/legal/privacy). If they differ on something about the program, these terms apply." },
      { h2: "2. Joining" },
      { ul: [
        "You must be at least 18 years old and able to enter a contract.",
        "Join on [Yolias Partners](/partners/join) with your name and email and accept these terms. There is no application and no Yolias subscription is needed.",
        "One partner account per person or company. Yolias may suspend an account that breaks these terms or shows signs of fraud.",
      ] },
      { h2: "3. Your referral link" },
      { ul: [
        "Your personal link is in your partner dashboard. You can add a campaign tag to compare where your signups come from.",
        "A visit through your link is remembered in the visitor’s browser for {window}. If they create a Yolias account in that time, the account is referred to you.",
        "The current rule decides which link keeps a referral when a visitor clicks more than one: {model}.",
        "Signups on another device, with cookies blocked or after the window can’t be attributed.",
      ] },
      { h2: "4. Commissions" },
      { ul: [
        "Commission: {rate} of what the customer actually paid for an eligible plan, before tax.",
        "Recurring payments: {recurring}.",
        "A commission is created only when the payment provider confirms the payment. Free trials, free signups and failed payments earn nothing.",
        "Annual plans pay one commission for the yearly payment.",
        "Refunded or disputed payments reverse their commission, also after it was paid out (the amount is deducted from your next payouts).",
      ] },
      { h2: "5. Waiting period and payouts" },
      { ul: [
        "Each commission waits {hold} before it becomes available, so refunds can settle.",
        "You can request a payout once your available balance reaches {minPayout}.",
        "Choose an enabled payout method in your dashboard and enter your details. The Yolias team reviews each request, sends the money and records the transfer reference. You get an email at every step.",
        "Commissions are paid in USD. Transfer fees charged by your bank or payout provider, and any taxes on your earnings, are yours.",
      ] },
      { h2: "6. How you may promote Yolias" },
      { p: "Recommend Yolias honestly, to people it can help. You may share your link on your website, social accounts, newsletter, videos, courses and communities." },
      { h3: "Not allowed" },
      { ul: [
        "Referring yourself, your own company or accounts you control.",
        "Paid search ads on the Yolias name or misspellings of it, and domains or social accounts that look like official Yolias ones.",
        "Spam, unsolicited bulk messages, or buying traffic from incentive or cashback sites without written approval.",
        "Misleading claims about Yolias, its prices, results or features, or offering discounts Yolias didn’t approve.",
        "Hiding that you earn a commission. Say clearly that your link is an affiliate link where the law or the platform asks for it.",
      ] },
      { p: "Breaking these rules can mean rejected commissions, a held balance or a closed partner account." },
      { h2: "7. Customers’ privacy" },
      { p: "You see each referral with a short reference, its signup date and whether it became a paying customer. Customers’ names and emails stay private." },
      { h2: "8. Partner network" },
      { p: "You can choose to appear in the partner network on the [affiliate page](/affiliates#network) with your name, photo, role and country. Your partnership level and success rate are calculated from your real referrals and confirmed payments. You can stop appearing at any time from your profile." },
      { h2: "9. Changes and ending" },
      { ul: [
        "Yolias may change the program, the commission or these terms. A change applies to payments made after it; partners are told about material changes.",
        "You can leave the program at any time by contacting support. Available commissions that reached the minimum payout are still paid.",
        "Yolias may end the program with notice; confirmed commissions earned before that are honoured under these terms.",
      ] },
      { h2: "10. Contact" },
      { p: "Questions about the program or a payout? Use the [Contact page](/contact?topic=support) or the support chat in your partner dashboard." },
    ],
  },
  ar: {
    title: "شروط برنامج شركاء يولـياس",
    seoTitle: "شروط برنامج الشركاء | يولـياس",
    summary: "كيف يعمل برنامج الأفلييت في يولـياس: الانضمام، روابط الإحالة، العمولات، فترة الانتظار، السحب، قواعد الترويج وكيف يمكن أن يتغير البرنامج.",
    version: "إصدار البرنامج {version}",
    blocks: [
      { h2: "1. البرنامج" },
      { p: "برنامج شركاء يولـياس («البرنامج») تديره شركة Yolias LLC، ويتيح لك ربح عمولة عندما يدفع العملاء الذين تحيلهم مقابل خطة في يولـياس. تُطبَّق هذه الشروط مع [شروط الخدمة](/legal/terms) و[سياسة الخصوصية](/legal/privacy)، وإذا اختلفت في أمر يخص البرنامج فهذه الشروط هي المعتمدة." },
      { h2: "2. الانضمام" },
      { ul: [
        "يجب أن يكون عمرك 18 عامًا على الأقل وأن تكون أهلًا للتعاقد.",
        "انضم من [شركاء يولـياس](/partners/join) باسمك وبريدك ووافق على هذه الشروط. بدون طلب انضمام وبدون اشتراك في يولـياس.",
        "حساب شريك واحد لكل شخص أو شركة. يمكن ليولـياس إيقاف أي حساب يخالف هذه الشروط أو تظهر عليه علامات احتيال.",
      ] },
      { h2: "3. رابط الإحالة الخاص بك" },
      { ul: [
        "رابطك الشخصي موجود في لوحة الشريك، ويمكنك إضافة وسم حملة لتقارن مصادر التسجيلات.",
        "تُحفظ الزيارة عبر رابطك في متصفح الزائر لمدة {window}. إذا أنشأ حسابًا في يولـياس خلالها تُنسب الإحالة إليك.",
        "عند ضغط الزائر على أكثر من رابط، تحدد القاعدة الحالية من يحتفظ بالإحالة: {model}.",
        "لا يمكن نسبة التسجيل من جهاز آخر أو مع حظر ملفات تعريف الارتباط أو بعد انتهاء المدة.",
      ] },
      { h2: "4. العمولات" },
      { ul: [
        "العمولة: {rate} مما دفعه العميل فعلًا مقابل خطة مؤهلة، قبل الضرائب.",
        "الدفعات المتكررة: {recurring}.",
        "تُنشأ العمولة فقط عندما يؤكد مزود الدفع الدفعة. لا عمولة على التجارب المجانية أو التسجيل المجاني أو الدفع الفاشل.",
        "الخطط السنوية لها عمولة واحدة عن الدفعة السنوية.",
        "الدفعات المستردة أو المعترض عليها تعكس عمولتها، حتى بعد صرفها (يُخصم المبلغ من مدفوعاتك القادمة).",
      ] },
      { h2: "5. فترة الانتظار والسحب" },
      { ul: [
        "تنتظر كل عمولة {hold} قبل أن تصبح متاحة، حتى تستقر طلبات الاسترداد.",
        "يمكنك طلب السحب عندما يصل رصيدك المتاح إلى {minPayout}.",
        "اختر طريقة سحب مفعّلة من لوحتك وأدخل بياناتك. يراجع فريق يولـياس كل طلب ويرسل المبلغ ويسجّل مرجع التحويل، وتصلك رسالة في كل خطوة.",
        "تُصرف العمولات بالدولار الأمريكي. رسوم التحويل التي يفرضها بنكك أو مزود السحب، وأي ضرائب على أرباحك، تتحملها أنت.",
      ] },
      { h2: "6. كيف تروّج ليولـياس" },
      { p: "رشّح يولـياس بصدق لمن يمكن أن يستفيد منه. يمكنك مشاركة رابطك في موقعك وحساباتك ونشرتك البريدية وفيديوهاتك ودوراتك ومجتمعاتك." },
      { h3: "غير مسموح" },
      { ul: [
        "إحالة نفسك أو شركتك أو حسابات تتحكم فيها.",
        "الإعلانات المدفوعة في محركات البحث على اسم يولـياس أو أخطائه الإملائية، والنطاقات أو الحسابات التي تشبه حسابات يولـياس الرسمية.",
        "الرسائل المزعجة أو الجماعية غير المطلوبة، أو شراء زيارات من مواقع المكافآت والكاش باك بدون موافقة مكتوبة.",
        "الادعاءات المضللة عن يولـياس أو أسعاره أو نتائجه أو ميزاته، أو عرض خصومات لم يوافق عليها يولـياس.",
        "إخفاء أنك تربح عمولة. وضّح أن رابطك رابط أفلييت حيثما يطلب القانون أو المنصة ذلك.",
      ] },
      { p: "مخالفة هذه القواعد قد تعني رفض العمولات أو تعليق الرصيد أو إغلاق حساب الشريك." },
      { h2: "7. خصوصية العملاء" },
      { p: "ترى كل إحالة برقم مرجعي قصير وتاريخ التسجيل وهل أصبحت عميلًا دافعًا. أسماء العملاء وبريدهم يبقيان خاصين." },
      { h2: "8. شبكة الشركاء" },
      { p: "يمكنك اختيار الظهور في شبكة الشركاء في [صفحة الأفلييت](/affiliates#network) باسمك وصورتك ووظيفتك وبلدك. مستوى شراكتك ومعدل نجاحك يُحسبان من إحالاتك الحقيقية ودفعاتها المؤكدة، ويمكنك إيقاف الظهور في أي وقت من ملفك." },
      { h2: "9. التغييرات والإنهاء" },
      { ul: [
        "يمكن ليولـياس تغيير البرنامج أو العمولة أو هذه الشروط. يُطبَّق التغيير على الدفعات التي تتم بعده، ويُبلَّغ الشركاء بالتغييرات الجوهرية.",
        "يمكنك ترك البرنامج في أي وقت بالتواصل مع الدعم، وتُصرف العمولات المتاحة التي بلغت الحد الأدنى للسحب.",
        "يمكن ليولـياس إنهاء البرنامج بإشعار مسبق، وتُحترم العمولات المؤكدة المكتسبة قبل ذلك وفق هذه الشروط.",
      ] },
      { h2: "10. التواصل" },
      { p: "أسئلة عن البرنامج أو عن السحب؟ استخدم [صفحة التواصل](/contact?topic=support) أو محادثة الدعم في لوحة الشريك." },
    ],
  },
};
