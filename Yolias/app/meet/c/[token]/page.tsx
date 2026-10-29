import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { CalendarX2, CheckCircle2 } from "lucide-react";
import { noindex } from "@/lib/seo";
import { getLocale } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelMeeting } from "@/lib/meetings";

export const metadata: Metadata = { title: "Cancel the meeting", robots: noindex };

// The guest's cancel link from the confirmation email (D-267). Opening it
// changes nothing; the button cancels and tells the host.
const copy = {
  en: { title: "Cancel this meeting?", button: "Cancel the meeting", reason: "Reason (optional)", done: "The meeting is canceled", doneLead: "The host has been told.", invalid: "This meeting was already canceled or the link isn't valid." },
  ar: { title: "إلغاء هذا الاجتماع؟", button: "إلغاء الاجتماع", reason: "السبب (اختياري)", done: "تم إلغاء الاجتماع", doneLead: "تم إبلاغ صاحب الاجتماع.", invalid: "أُلغي هذا الاجتماع بالفعل أو الرابط غير صالح." },
};

export default async function CancelMeetingPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }> }) {
  const { token } = await params;
  const locale = await getLocale();
  const t = copy[locale];
  const valid = /^[0-9a-f-]{36}$/i.test(token);
  const { data: m } = valid ? await createAdminClient().from("sales_meetings").select("title, starts_at, status").eq("cancel_token", token).maybeSingle() : { data: null };
  const done = (await searchParams).done === "1";
  async function cancel(form: FormData) {
    "use server";
    await cancelMeeting({ token }, String(form.get("reason") ?? "").slice(0, 300) || null);
    revalidatePath(`/meet/c/${token}`);
    const { redirect } = await import("next/navigation");
    redirect(`/meet/c/${token}?done=1`);
  }
  const when = m ? new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { dateStyle: "full", timeStyle: "short" }).format(new Date(m.starts_at)) : "";
  return (
    <div className="meet-page" dir={locale === "ar" ? "rtl" : "ltr"}>
      <main className="meet-card meet-done">
        {done ? (<><CheckCircle2 className="meet-done-icon" /><h2>{t.done}</h2><p>{t.doneLead}</p></>)
          : !m || m.status !== "scheduled" ? (<><CalendarX2 className="meet-done-icon" /><p>{t.invalid}</p></>)
          : (
            <form action={cancel} className="meet-form">
              <h2>{t.title}</h2>
              <p dir="auto"><strong>{m.title}</strong><br />{when}</p>
              <label>{t.reason}<textarea name="reason" rows={2} maxLength={300} dir="auto" /></label>
              <button type="submit" className="meet-submit danger">{t.button}</button>
            </form>
          )}
      </main>
    </div>
  );
}
