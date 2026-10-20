import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, MailX } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { noindex } from "@/lib/seo";
import { fmt } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { profileByToken, unsubscribeByToken } from "@/lib/messaging/unsubscribe";
import { revalidatePath } from "next/cache";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).unsubscribe.title} | Yolias`, robots: noindex };
}

// Unsubscribe page (D-243), linked from every lifecycle and marketing email.
// Opening it changes nothing; the button does (so link scanners can't
// unsubscribe anyone).
export default async function UnsubscribePage({ params }: PageProps<"/unsubscribe/[token]">) {
  const { token } = await params;
  const [t, p] = await Promise.all([getDictionary(), profileByToken(token)]);
  const u = t.unsubscribe;
  async function confirm() {
    "use server";
    await unsubscribeByToken(token);
    revalidatePath(`/unsubscribe/${token}`);
  }
  const done = Boolean(p?.unsubscribed_at);
  return (
    <div className="checkout-page">
      <header className="checkout-top">
        <Link href="/" aria-label="Yolias"><BrandLogo /></Link>
      </header>
      <main className="billing-result">
        {!p ? (
          <><MailX className="billing-result-icon bad" /><h1>{u.invalid}</h1></>
        ) : done ? (
          <><CheckCircle2 className="billing-result-icon ok" /><h1>{u.done}</h1><p className="billing-result-detail" dir="auto">{fmt(u.doneLead, { email: p.email })}</p></>
        ) : (
          <>
            <MailX className="billing-result-icon" />
            <h1>{u.title}</h1>
            <p className="billing-result-detail" dir="auto">{fmt(u.lead, { email: p.email })}</p>
            <form action={confirm} className="billing-result-actions">
              <button className="btn-primary" type="submit">{u.button}</button>
            </form>
          </>
        )}
        <div className="billing-result-actions">
          <Link className="btn-secondary" href="/">{u.open}</Link>
        </div>
      </main>
    </div>
  );
}
