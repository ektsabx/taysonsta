import type { Metadata } from "next";
import { ErrorScreen } from "@/components/ErrorScreen";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).errorPages.notFoundTitle} — Yolias` };
}

export default async function NotFound() {
  const t = await getDictionary();
  const e = t.errorPages;
  return (
    <ErrorScreen
      code={e.notFoundCode}
      title={e.notFoundTitle}
      body={e.notFoundBody}
      primary={{ label: e.goHome, href: "/" }}
      secondary={{ label: t.site.helpCenter, href: "/help-center" }}
    />
  );
}
