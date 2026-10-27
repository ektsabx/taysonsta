import { connection } from "next/server";
import { blogPosts, docPages, helpArticles } from "@/lib/content/store";
import { solutions, solutionSlugs } from "@/lib/content/solutions";
import { solutionSeo } from "@/lib/content/solutions-seo";
import { useCases, useCaseSlugs } from "@/lib/content/use-cases";
import { home } from "@/lib/content/site";
import { DEFINITION, siteUrl } from "@/lib/seo";
import { indexableSeoPages } from "@/lib/content/seo-store";
import type { SeoKind } from "@/lib/content/seo-pages";

// /llms.txt (D-179): a plain summary of what Yolias is and does, with links
// to the pages that explain it, for AI assistants and answer engines
// (https://llmstxt.org). Built from the same content as the website, so it
// changes when the site does. Only public pages; nothing private.
export async function GET() {
  await connection();
  const base = siteUrl();
  const [help, docs, posts, seo] = await Promise.all([helpArticles(), docPages(), blogPosts(), indexableSeoPages()]);
  const seoSection = (kind: SeoKind, title: string) => {
    const pages = seo.filter((p) => p.kind === kind);
    return pages.length ? `\n## ${title}\n${pages.map((p) => line(p.copy.en.title, p.path, p.copy.en.metaDescription)).join("\n")}\n` : "";
  };
  const line = (title: string, path: string, note?: string) => `- [${title}](${base}${path})${note ? `: ${note}` : ""}`;
  const faq = home.en.faq.items.map((f) => `### ${f.q}\n${f.a}`).join("\n\n");
  const body = `# Yolias

> ${DEFINITION}

Yolias works in English and Arabic. It finds and qualifies prospects, prepares outreach campaigns, writes and sends them from the user's own mailbox (Gmail or any IMAP/SMTP account) only after the user approves, reads and sorts replies in the Inbox and keeps the CRM up to date; it never messages anyone on LinkedIn. Results depend on the market and on the data sources connected to Yolias, and Yolias doesn't guarantee a number of leads, meetings or sales.

## What Yolias does today
- Turns a plain-language description of an ideal customer (or an attached brief, CSV or screenshot) into structured search criteria and a search.
- Search types: decision makers at matching companies, companies, local businesses by category and area, and companies similar to ones you name.
- Shows a match score with the criteria each result met, and the public business contact details a company publishes.
- Writes personalized first emails and follow-ups in 15 languages and sends them from the user's own connected mailbox after approval. Business email and LinkedIn are the contact details Yolias looks for first; it doesn’t collect WhatsApp numbers, and missing details are shown as not available rather than guessed.
- Searches that keep adding new matching companies on a schedule; analytics on discovery, outreach and activity; CSV export; unlimited users on every plan.
- Campaigns: a list with each campaign's progress, leads, sends and replies; a campaign page with analytics (contacted, sent, replied, bounced, failed, where leads stand, daily send activity), its leads and its sequence; a four-step wizard to create one. A first message and follow-ups per lead, prepared by AI from the user's Company Knowledge, offers and customer profile; the user reviews and approves them, and Yolias sends them from the user's connected mailbox (or the user sends them from their own app and marks them sent).
- Conversations: one inbox of every email reply across the user's mailboxes (Inbox, Replies, To approve, Out of office, Sent, Done), one conversation per lead with prepared and sent messages, replies that arrive in the connected mailbox (or that the user logs), reminders and planned send times; AI reads a reply, suggests the next stage and drafts an answer.
- CRM: a pipeline of every lead with a conversation, by where it stands (needs action, waiting on them, follow-ups exhausted), as a board or list; each lead keeps one record with deal stage, deal value, owner, meetings, reminders, notes and full history.
- Email sending rules: emails per day per mailbox, a random gap between emails, and sending days and hours in each mailbox's time zone; out-of-office replies pause the follow-up for a week instead of stopping it.
- Company Knowledge (with offers and competitors) and a Customer Profile that Yolias writes from the company's website; they guide searches, emails and replies. Campaigns (emails written per person and sent from the user's mailbox) and their replies (labelled interested, not interested or needs follow-up, with AI-suggested answers) are together in Conversations.

## Main pages
${line("Product", "/product", "how Yolias AI turns a brief into a list of matching companies and decision makers")}
${line("Pricing", "/pricing", "Pay As You Go credit ($5, $20, $50 or $100 top-ups, no subscription) or the monthly plans Pro ($50) and Growth ($100); every feature and unlimited users, you pay for prospects only, emails are never charged, no free trial")}
${line("Solutions", "/solutions", "how Yolias fits different service businesses")}
${solutionSlugs.map((s) => line(solutionSeo[s].en.seoTitle, `/solutions/${s}`, solutions[s].en.metaDescription)).join("\n")}

${seo.filter((p) => p.kind === "solution").map((p) => line(p.copy.en.title, p.path, p.copy.en.metaDescription)).join("\n")}

## Guides
${line("Use cases", "/use-cases")}
${useCaseSlugs.map((s) => line(useCases[s].en.title, `/use-cases/${s}`, useCases[s].en.answer)).join("\n")}
${seoSection("template", "Prospecting templates")}${seoSection("compare", "Comparisons")}${seoSection("alternatives", "Alternatives")}
## Frequently asked questions
${faq}

## Help and documentation
${help.map((a) => line(a.doc.en.title, `/help-center/${a.slug}`, a.doc.en.summary)).join("\n")}
${docs.map((d) => line(d.doc.en.title, `/docs/${d.slug}`, d.doc.en.summary)).join("\n")}

## Blog
${posts.map((p) => line(p.doc.en.title, `/blog/${p.slug}`, p.doc.en.summary)).join("\n")}

## Company
${line("About", "/about")}
${line("Contact", "/contact")}
${line("Affiliate program", "/affiliates")}
${line("Partner program terms", "/partners/terms", "Commission, referral window, waiting period, payouts and promotion rules of the Yolias affiliate program.")}
${line("Full site text for AI assistants", "/llms-full.txt", "Every public page of Yolias as plain text: product, pricing, help, docs, guides, legal and the partner program.")}
${line("Community", "/community", "The Yolias community of founders, marketers and sales teams (a Facebook group, free, English and Arabic).")}
${line("Service status", "/status")}
${line("Privacy policy", "/legal/privacy")}
${line("Terms of service", "/legal/terms")}
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
