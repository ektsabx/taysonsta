import { connection } from "next/server";
import { blogPosts, docPages, helpArticles } from "@/lib/content/store";
import { solutions, solutionSlugs } from "@/lib/content/solutions";
import { solutionSeo } from "@/lib/content/solutions-seo";
import { useCases, useCaseSlugs } from "@/lib/content/use-cases";
import { home } from "@/lib/content/site";
import { DEFINITION, siteUrl } from "@/lib/seo";

// /llms.txt (D-179): a plain summary of what Yolias is and does, with links
// to the pages that explain it, for AI assistants and answer engines
// (https://llmstxt.org). Built from the same content as the website, so it
// changes when the site does. Only public pages; nothing private.
export async function GET() {
  await connection();
  const base = siteUrl();
  const [help, docs, posts] = await Promise.all([helpArticles(), docPages(), blogPosts()]);
  const line = (title: string, path: string, note?: string) => `- [${title}](${base}${path})${note ? `: ${note}` : ""}`;
  const faq = home.en.faq.items.map((f) => `### ${f.q}\n${f.a}`).join("\n\n");
  const body = `# Yolias

> ${DEFINITION}

Yolias works in English and Arabic. It finds and qualifies prospects, prepares outreach campaigns, sends them from the user's own Gmail or Outlook only after the user approves, reads replies and keeps the CRM up to date; LinkedIn messages are always sent by the user. Results depend on the market and on the data sources connected to Yolias, and Yolias doesn't guarantee a number of leads, meetings or sales.

## What Yolias does today
- Turns a plain-language description of an ideal customer (or an attached brief, CSV or screenshot) into structured search criteria and a discovery campaign.
- Search types: decision makers at matching companies, companies, local businesses by category and area, and companies similar to ones you name.
- Shows a match score with the criteria each result met, and the public business contact details a company publishes.
- Drafts first emails and LinkedIn notes in 15 languages; the user sends them from their own accounts. Business email and LinkedIn are the contact details Yolias looks for first; it doesn’t collect WhatsApp numbers, and missing details are shown as not available rather than guessed.
- Continuous campaigns that keep adding new matching companies on a schedule; analytics; CSV export; unlimited users on every plan.
- Outreach campaigns: a first message and follow-ups per lead, prepared by AI from the user's Company Knowledge, offers and customer profile; the user reviews each one, sends it from their own email or app and marks it sent. Yolias doesn't connect to a mailbox yet, so it doesn't send or receive email itself.
- Inbox: one conversation per lead with prepared and sent messages, replies the user logs, reminders and planned send times; AI reads a logged reply, suggests the next stage and drafts an answer.
- CRM: one record per person or company with deal stages (Interested, Meeting Booked, Meeting Completed, Closed, Lost), deal value, owner, meetings with links, reminders, notes and full history, as a table or Kanban.
- AI Workspace: Company Knowledge (with offers and competitors), Customer Profiles used by searches and messages, and one AI agent the user gives a customer-acquisition goal. Research, outreach, replies, follow-up, meetings and CRM updates are its capabilities; its settings decide what it does on its own and what needs the user's approval.

## Main pages
${line("Product", "/product", "how Yolias AI turns a brief into a campaign")}
${line("Pricing", "/pricing", "Pro, Growth and Scale, each with a 7-day free trial; unlimited users")}
${line("Solutions", "/solutions", "how Yolias fits different service businesses")}
${solutionSlugs.map((s) => line(solutionSeo[s].en.seoTitle, `/solutions/${s}`, solutions[s].en.metaDescription)).join("\n")}

## Guides
${line("Use cases", "/use-cases")}
${useCaseSlugs.map((s) => line(useCases[s].en.title, `/use-cases/${s}`, useCases[s].en.answer)).join("\n")}

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
