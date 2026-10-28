import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { CheckCircle2, MailX } from "lucide-react";
import { noindex } from "@/lib/seo";
import { leadByUnsubscribeToken, unsubscribeLead } from "@/lib/outreach/unsubscribe";

export const metadata: Metadata = { title: "Unsubscribe", robots: noindex };

// The page the unsubscribe line in a campaign email opens (owner, 2026-10-28).
// The reader is the lead, not a Yolias user: in the email's language (?l=ar),
// in the sender's name, no app links. Opening it changes nothing; the button does.
const copy = {
  en: {
    title: "Unsubscribe", lead: (c: string) => `Stop receiving emails from ${c}.`, button: "Unsubscribe",
    done: "You're unsubscribed", doneLead: (c: string) => `${c} won't email you again from this campaign or any other.`,
    invalid: "This link isn't valid anymore.", someone: "the sender", by: "Sent with Yolias",
  },
  ar: {
    title: "إلغاء الاشتراك", lead: (c: string) => `إيقاف الرسائل من ${c}.`, button: "إلغاء الاشتراك",
    done: "تم إلغاء الاشتراك", doneLead: (c: string) => `لن تصلك رسائل أخرى من ${c}، لا من هذه الحملة ولا غيرها.`,
    invalid: "هذا الرابط لم يعد صالحًا.", someone: "المرسل", by: "أُرسلت عبر Yolias",
  },
};

export default async function LeadUnsubscribePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ l?: string }> }) {
  const { token } = await params;
  const t = copy[(await searchParams).l === "ar" ? "ar" : "en"];
  const lead = await leadByUnsubscribeToken(token);
  async function confirm() {
    "use server";
    await unsubscribeLead(token);
    revalidatePath(`/u/${token}`);
  }
  const company = lead?.company || t.someone;
  return (
    <div className="checkout-page" dir={t === copy.ar ? "rtl" : "ltr"}>
      <main className="billing-result">
        {!lead ? (
          <><MailX className="billing-result-icon bad" /><h1>{t.invalid}</h1></>
        ) : lead.unsubscribed_at ? (
          <><CheckCircle2 className="billing-result-icon ok" /><h1>{t.done}</h1><p className="billing-result-detail" dir="auto">{t.doneLead(company)}</p></>
        ) : (
          <>
            <MailX className="billing-result-icon" />
            <h1>{t.title}</h1>
            <p className="billing-result-detail" dir="auto">{t.lead(company)}</p>
            <form action={confirm} className="billing-result-actions">
              <button className="btn-primary" type="submit">{t.button}</button>
            </form>
          </>
        )}
        <p className="billing-result-detail" style={{ fontSize: 12, opacity: 0.7 }}>{t.by}</p>
      </main>
    </div>
  );
}
