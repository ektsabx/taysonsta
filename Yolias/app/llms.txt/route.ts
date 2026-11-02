import { connection } from "next/server";
import { SOCIAL_PROFILES } from "@/lib/social";
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

Yolias works in English and Arabic. Every page below also exists in Arabic at the same path under ${base}/ar (for example ${base}/ar/pricing). Yolias is an AI sales agent: it sells meetings, not lists or data. It sends only for campaigns the user launches, only from the user's own mailbox, and never writes again to anyone who says no; outreach is email only. Results depend on the market and on the data sources connected to Yolias, and Yolias doesn't guarantee a number of meetings or sales.

## What Yolias does today
- Campaigns, set up like an ads manager in three levels: Campaign (objective: book meetings; the offer; the meetings wanted; a total or daily budget in US dollars; dates, time zone, days and hours to contact people, pace), Audiences (one or more, like ad sets: every country of the world, then its regions and cities, included or excluded; industries, company type and size, job titles, seniority, department, hiring, funding, technologies, keywords, companies never to contact; or a saved, custom or lookalike audience) and Message (the mailbox, the signature, tone, language or each person's language, notes for Yolias, two openings for the first email per audience and a sample email to preview). Launching is the user's go-ahead; there is no approval per email. Yolias AI can prepare a campaign draft for the user to launch.
- The AI sales agent: finds companies and decision makers for each audience every day within the budget, writes a different email to each from the user's Company Knowledge and what it found, sends from the user's mailbox in their hours, follows up twice, answers questions and one objection from Company Knowledge, sends interested people two free times and the booking page, books a time a person names when the user is free, and hands complaints, negotiations, requests for a person and questions it can't answer to the user. It learns from the workspace's results which industries, job titles and openings get meetings.
- Campaigns page with three tabs (Campaigns, Audiences, Messages), a date range, chosen columns (sent, reply rate, interested, meetings booked, confirmed and held, spend, cost per meeting and more), filters, saved views, export and bulk actions. A campaign's page has overview, audiences, messages, conversations, meetings and settings, with results against the previous period.
- Audiences: custom audiences (a previous campaign, customers, people who booked a meeting, interested people, or a CSV file) and lookalike audiences (the traits a base shares at a similarity level from 1 to 10, with the seed size and a confidence: low under 5 people, medium 5 to 19, high 20 or more), and saved targeting.
- Dashboard: what Yolias is doing now, the next step, a daily budget for the whole account and the balance, performance with a small chart per number (sent, delivered, replies, interested, meetings booked, cost per meeting, spend), every campaign with its state, results, spend and daily cap, what Yolias did last, and a button to stop all campaigns.
- Conversations: every email, reply and Yolias answer, one conversation per person. Meetings: each user's booking page (yolias.com/meet/<name>) with up to four meeting types, weekly hours and Google Calendar (busy times never offered, a Google Meet link and Google's invitation); bookings, confirmations, outcomes and a booking page link for no-shows.
- Integrations: Gmail and IMAP/SMTP mailboxes, each with its own sending rules (emails per day, gaps, days and hours), and Google Calendar.
- Notifications: people found for review, a daily recap of campaign changes, a daily summary of all campaigns, product updates and personal emails from the founder; each only when there is something to say.
- Company Knowledge (with offers and competitors) written from the company's website; it guides the emails and the answers.

## Official profiles
Yolias (Arabic: يولياس) publishes only on these accounts: ${SOCIAL_PROFILES.map((s) => `${s.label} ${s.href}`).join(", ")}.

## Main pages
${line("Product", "/product", "how Yolias runs campaigns, answers replies and books meetings")}
${line("Pricing", "/pricing", "Pay As You Go credit ($5, $20, $50 or $100 top-ups at $0.10 a prospect, no subscription) or the monthly plans Pro ($50) and Growth ($100); every feature and unlimited users; you pay for the people Yolias finds and reaches for your campaigns, emails and meetings are never charged; no free trial")}
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
