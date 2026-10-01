import { notFound } from "next/navigation";
import { emailNames, sampleEmail, type EmailName } from "../samples";

// Raw HTML of one email (used by the preview iframe). Development only.
export async function GET(request: Request, { params }: RouteContext<"/dev/emails/[name]">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { name } = await params;
  if (!(emailNames as readonly string[]).includes(name)) notFound();
  const url = new URL(request.url);
  const locale = url.searchParams.get("lang") === "ar" ? "ar" : "en";
  const { html } = sampleEmail(name as EmailName, locale, url.origin);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
