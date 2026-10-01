import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { emailNames, sampleEmail, type EmailName } from "./samples";

export const metadata: Metadata = { title: "Emails — Yolias" };

// Preview of every Yolias email in both languages. Development only.
export default async function EmailsPreview({ searchParams }: PageProps<"/dev/emails">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const name: EmailName = (emailNames as readonly string[]).includes(String(sp.name)) ? (sp.name as EmailName) : "magic_link";
  const lang = sp.lang === "ar" ? "ar" : "en";
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const subject = sampleEmail(name, lang, origin).subject;

  return (
    <div className="email-preview">
      <aside>
        <strong>Emails</strong>
        {emailNames.map((n) => (
          <Link key={n} href={`/dev/emails?name=${n}&lang=${lang}`} className={n === name ? "active" : ""}>{n.replace(/_/g, " ")}</Link>
        ))}
        <div className="email-preview-langs">
          <Link href={`/dev/emails?name=${name}&lang=en`} className={lang === "en" ? "active" : ""}>English</Link>
          <Link href={`/dev/emails?name=${name}&lang=ar`} className={lang === "ar" ? "active" : ""}>العربية</Link>
        </div>
      </aside>
      <main>
        <div className="email-preview-subject"><span>Subject</span> <b dir="auto">{subject}</b></div>
        <iframe title={name} src={`/dev/emails/${name}?lang=${lang}`} />
      </main>
    </div>
  );
}
