import type { Metadata } from "next";
import Link from "@/components/LocaleLink";
import { ChevronLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n/server";
import { noindex, pageMetadata } from "@/lib/seo";
import { playableTutorials, TUTORIALS_KEY, type PlayableTutorial } from "@/lib/tutorials";

const copy = {
  en: { title: "Platform videos", lead: "Short walkthroughs of Yolias: from your first search to your first campaign.", empty: "The first videos are on their way. Meanwhile, the Help Center answers the common questions.", back: "Help Center", open: "Open the video" },
  ar: { title: "شرح المنصة بالفيديو", lead: "جولات قصيرة في يولـياس: من أول بحث حتى أول حملة.", empty: "أول الفيديوهات في الطريق. حتى ذلك الحين، مركز المساعدة يجيب عن الأسئلة الشائعة.", back: "مركز المساعدة", open: "افتح الفيديو" },
};

async function load(locale: "en" | "ar"): Promise<PlayableTutorial[]> {
  try {
    const { data } = await createAdminClient().from("site_settings").select("value").eq("key", TUTORIALS_KEY).maybeSingle();
    return playableTutorials(data?.value, locale);
  } catch {
    return [];
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const c = copy[locale];
  const list = await load(locale);
  const meta = await pageMetadata({ title: `${c.title} | Yolias`, description: c.lead, path: "/help-center/videos" });
  // Nothing to index until the first video is published.
  return list.length ? meta : { ...meta, robots: noindex };
}

// Platform videos (owner, 2026-10-28), listed in Yolias Admin → Platform videos.
export default async function VideosPage() {
  const locale = await getLocale();
  const c = copy[locale];
  const list = await load(locale);
  return (
    <section className="section">
      <div className="site-width">
        <Link className="doc-back" href="/help-center"><ChevronLeft className="flip-rtl" width={16} height={16} aria-hidden="true" /> {c.back}</Link>
        <h1 className="display-font tutorials-title">{c.title}</h1>
        <p className="lead">{c.lead}</p>
        {!list.length ? <p className="tutorials-empty">{c.empty}</p> : (
          <div className="tutorials-grid">
            {list.map((v) => (
              <article key={v.id} className="tutorial-card">
                <div className="tutorial-frame">
                  {v.kind === "iframe"
                    ? <iframe src={v.src} title={v.title} allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
                    : <video src={v.src} controls preload="metadata" />}
                </div>
                <h2 dir="auto">{v.title}</h2>
                {v.description && <p dir="auto">{v.description}</p>}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
