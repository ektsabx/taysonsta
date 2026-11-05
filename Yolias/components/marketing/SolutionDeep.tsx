import Link from "@/components/LocaleLink";
import { Check } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { Faq } from "@/components/marketing/Faq";

// What a buyer needs before signing up (owner, 2026-11-05), on every solution
// page: the options compared, what is included, what it costs, the first month
// and the common questions. Numbers are Yolias's own prices and planning estimates.
const T = {
  en: {
    compare: { title: "Your options, side by side", lead: (n: string) => `How ${n} usually get customers, and what each path takes.`, head: ["", "By hand", "Data tools (like Clay or Apollo)", "Paid ads", "Yolias"], rows: [
      ["Who finds the people", "You", "The tool, you build the list", "The platform shows ads to a crowd", "Yolias AI, every day"],
      ["Who writes the messages", "You", "You, or a separate writing step", "You make the ads", "Yolias AI, one per person"],
      ["Who answers replies", "You", "You, in another tool", "You", "Yolias AI, and it hands you what needs you"],
      ["Who books the meeting", "You", "You", "You", "Yolias AI, on your booking page"],
      ["How you pay", "Your time", "Subscription and credits", "Per click or view", "Per person reached, from $5"],
      ["What you read", "A spreadsheet", "Lists and exports", "Clicks and views", "Cost per meeting"],
    ] },
    included: { title: "Everything included in every option", items: ["Campaigns, audiences and lookalikes", "Buying intent, hiring and funding signals", "A different email for each person", "Two follow-ups, and answers to replies", "Your booking page and Google Calendar", "The Yolias pixel and Events Manager", "Results by audience, country and job title", "Arabic and English, unlimited users"] },
    cost: { title: "What it costs, worked out", lead: "Signing up and building a campaign are free. You pay when you launch, for the people Yolias finds. Emails, replies and meetings are never charged.", rows: [["$5", "50 people reached", "A first test"], ["$50", "500 people reached", "About 7 to 15 interested replies and 2 to 7 meetings"], ["$100 a month (Growth)", "2,000 people a month", "About 30 to 60 interested replies and 10 to 30 meetings"]], note: "Estimates from campaign averages. Your market and offer decide the result; the campaign shows the real numbers as they come." },
    month: { title: "Your first 30 days", items: [["Day 1", "Sign up, check Company Knowledge, connect your mailbox and set your booking page."], ["Day 2", "Create a campaign with two or three audiences and launch from $5."], ["Week 1", "Yolias sends in your hours. Read the first replies in Conversations."], ["Week 2", "Yolias moves budget toward the audience that replies. Pause what doesn't."], ["Week 4", "Read cost per meeting by audience, keep the best, add a new market."]] },
    faq: { title: "Questions before you start", items: [
      ["Do I need to pay to try it?", "No. Signing up and building a campaign are free. You top up from $5 when you launch."],
      ["Whose email does it send from?", "Your own. Connect Gmail or any mailbox. Replies reach your mailbox and Yolias."],
      ["Will it say things I didn't approve?", "Yolias writes only from your Company Knowledge, and hands you what it can't answer."],
      ["How is this different from Clay?", "Clay builds and enriches lists, and you run the outreach. Yolias runs the campaign from finding people to the booked meeting, and reports cost per meeting."],
      ["How is this different from Facebook Ads?", "Ads show to a crowd and you pay for views or clicks. Yolias reaches the people you choose and you pay per person reached."],
      ["How many emails does it send?", "A new mailbox starts at 30 a day with a gap of 18 to 24 minutes. You control it, and can connect more mailboxes."],
    ] },
    cta: "Start free", related: "See a step-by-step use case",
  },
  ar: {
    compare: { title: "خياراتك جنبًا إلى جنب", lead: (n: string) => `كيف يحصل ${n} عادة على العملاء، وما يتطلبه كل طريق.`, head: ["", "يدويًا", "أدوات البيانات (مثل Clay أو Apollo)", "الإعلانات المدفوعة", "يولياس"], rows: [
      ["من يجد الأشخاص", "أنت", "الأداة، وأنت تبني القائمة", "تعرض المنصة الإعلان لجمهور واسع", "Yolias AI كل يوم"],
      ["من يكتب الرسائل", "أنت", "أنت أو خطوة كتابة منفصلة", "أنت تصمم الإعلان", "Yolias AI، رسالة لكل شخص"],
      ["من يرد", "أنت", "أنت من أداة أخرى", "أنت", "Yolias AI، ويسلمك ما يحتاجك"],
      ["من يحجز الاجتماع", "أنت", "أنت", "أنت", "Yolias AI على صفحة حجزك"],
      ["كيف تدفع", "من وقتك", "اشتراك ورصيد", "لكل نقرة أو مشاهدة", "لكل شخص تصل إليه، من 5 دولارات"],
      ["ماذا تقرأ", "جدول بيانات", "قوائم وملفات", "نقرات ومشاهدات", "تكلفة الاجتماع"],
    ] },
    included: { title: "كل هذا متاح في كل خيار", items: ["الحملات والجماهير والجماهير المشابهة", "إشارات نية الشراء والتوظيف والتمويل", "رسالة مختلفة لكل شخص", "متابعتان والرد على الردود", "صفحة الحجز وتقويم Google", "بيكسل يولياس ومدير الأحداث", "النتائج حسب الجمهور والبلد والمسمى", "العربية والإنجليزية ومستخدمون بلا حد"] },
    cost: { title: "التكلفة بالأرقام", lead: "التسجيل وبناء الحملة مجانًا. تدفع عند التشغيل مقابل من يجدهم يولياس. ولا تُحسب تكلفة على الرسائل والردود والاجتماعات.", rows: [["5 دولارات", "50 شخصًا", "تجربة أولى"], ["50 دولارًا", "500 شخص", "نحو 7 إلى 15 ردًا مهتمًا و2 إلى 7 اجتماعات"], ["100 دولار شهريًا (النمو)", "2,000 شخص شهريًا", "نحو 30 إلى 60 ردًا مهتمًا و10 إلى 30 اجتماعًا"]], note: "تقديرات من متوسطات الحملات. يحدد سوقك وعرضك النتيجة، وتعرض الحملة الأرقام الحقيقية عند وصولها." },
    month: { title: "أول 30 يومًا", items: [["اليوم 1", "سجّل، وراجع معرفة الشركة، واربط بريدك، واضبط صفحة الحجز."], ["اليوم 2", "أنشئ حملة بجمهورين أو ثلاثة وشغّلها من 5 دولارات."], ["الأسبوع 1", "يرسل يولياس في ساعاتك. اقرأ الردود الأولى في المحادثات."], ["الأسبوع 2", "يوجّه يولياس الميزانية نحو الجمهور الذي يرد. أوقف ما لا ينجح."], ["الأسبوع 4", "اقرأ تكلفة الاجتماع لكل جمهور، وأبقِ الأفضل، وأضف سوقًا جديدًا."]] },
    faq: { title: "أسئلة قبل أن تبدأ", items: [
      ["هل أدفع لأجرب؟", "لا. التسجيل وبناء الحملة مجانًا، وتشحن من 5 دولارات عند التشغيل."],
      ["من أي بريد يرسل؟", "من بريدك. اربط Gmail أو أي بريد، وتصل الردود إلى بريدك وإلى يولياس."],
      ["هل سيقول ما لم أوافق عليه؟", "يكتب يولياس من معرفة شركتك فقط، ويسلمك ما لا يستطيع إجابته."],
      ["ما الفرق بينه وبين Clay؟", "يبني Clay القوائم ويثريها وأنت تدير التواصل. ويدير يولياس الحملة من إيجاد الأشخاص إلى الاجتماع المحجوز، ويعرض تكلفة الاجتماع."],
      ["ما الفرق بينه وبين إعلانات فيسبوك؟", "تُعرض الإعلانات لجمهور واسع وتدفع للمشاهدات أو النقرات. ويصل يولياس إلى من تختارهم وتدفع لكل شخص."],
      ["كم رسالة يرسل؟", "يبدأ البريد الجديد بـ30 رسالة يوميًا بفاصل 18 إلى 24 دقيقة. والتحكم بيدك، ويمكنك ربط برائد أكثر."],
    ] },
    cta: "ابدأ مجانًا", related: "شاهد حالة استخدام خطوة بخطوة",
  },
};

export function SolutionDeep({ name, locale }: { name: string; locale: Locale }) {
  const c = T[locale];
  return (
    <>
      <section className="section alt">
        <div className="site-width">
          <div className="section-head"><h2 className="display-font">{c.compare.title}</h2><p>{c.compare.lead(name)}</p></div>
          <div className="sd-table"><table>
            <thead><tr>{c.compare.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{c.compare.rows.map((r) => <tr key={r[0]}>{r.map((v, i) => (i === 0 ? <th scope="row" key={i}>{v}</th> : <td key={i} className={i === 4 ? "sd-us" : ""}>{v}</td>))}</tr>)}</tbody>
          </table></div>
        </div>
      </section>
      <section className="section">
        <div className="site-width">
          <div className="section-head"><h2 className="display-font">{c.included.title}</h2></div>
          <ul className="sd-grid">{c.included.items.map((x) => <li key={x}><Check />{x}</li>)}</ul>
        </div>
      </section>
      <section className="section alt">
        <div className="site-width">
          <div className="section-head"><h2 className="display-font">{c.cost.title}</h2><p>{c.cost.lead}</p></div>
          <div className="sd-table"><table><tbody>{c.cost.rows.map((r) => <tr key={r[0]}><th scope="row">{r[0]}</th><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody></table></div>
          <p className="sd-note">{c.cost.note}</p>
        </div>
      </section>
      <section className="section">
        <div className="site-width">
          <div className="section-head"><h2 className="display-font">{c.month.title}</h2></div>
          <ol className="sd-month">{c.month.items.map(([k, v]) => <li key={k}><strong>{k}</strong><span>{v}</span></li>)}</ol>
          <div className="hero-actions"><Link className="btn-solid" href="/signup">{c.cta}</Link><Link className="btn-ghost" href="/use-cases">{c.related}</Link></div>
        </div>
      </section>
      <Faq title={c.faq.title} items={c.faq.items.map(([q, a]) => ({ q, a }))} />
    </>
  );
}
