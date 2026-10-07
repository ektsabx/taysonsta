import { whatsappDigits } from "@/lib/outreach/channels";
import { location } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { CompanyRow, ProspectRow } from "@/types/database";
import type { GridPerson } from "@/components/app/PeopleGrid";
import type { CardCompany } from "@/components/app/Cards";

/**
 * A prospect as a result card (D-147). Contact details leave the server only
 * once revealed; before that the card just says whether they're available.
 */
export function gridPerson(p: ProspectRow, company: { id: string; name: string } | null, locale: Locale): GridPerson {
  const email = p.email_status === "invalid" ? null : p.email;
  const revealed = Boolean(p.revealed_at);
  return {
    id: p.id, name: p.full_name, title: p.title, place: location(p.city, p.country, locale), company: company?.name ?? null, companyId: company?.id ?? null,
    photoUrl: p.photo_url, linkedinUrl: p.linkedin_url, emailStatus: p.email_status, hasEmail: Boolean(email), hasPhone: Boolean(p.phone),
    email: revealed ? email : null, phone: revealed ? p.phone : null, revealed, matchScore: p.match_score,
    hasWhatsapp: Boolean(whatsappDigits(p.whatsapp ?? p.phone)), facebookUrl: p.facebook_url, instagramUrl: p.instagram_url, bookmarked: Boolean(p.bookmarked_at),
  };
}

/** "51–200" style size band from an employee count. */
export function sizeBand(n: number | null): string | null {
  if (n == null) return null;
  const bands: [number, string][] = [[10, "1–10"], [50, "11–50"], [200, "51–200"], [500, "201–500"], [1000, "501–1,000"], [5000, "1,001–5,000"], [10000, "5,001–10,000"]];
  for (const [max, label] of bands) if (n <= max) return label;
  return "10,000+";
}

/** A company or local business as a card, with the decision makers already found there. */
export function cardCompany(
  c: Pick<CompanyRow, "id" | "kind" | "name" | "domain" | "website" | "logo_url" | "industry" | "category" | "city" | "country" | "employee_count" | "rating" | "reviews_count" | "bookmarked_at" | "people_status" | "people_requested_at">,
  people: { full_name: string; photo_url: string | null }[],
  locale: Locale,
): CardCompany {
  const local = c.kind === "local_business";
  const size = local ? null : sizeBand(c.employee_count);
  return {
    id: c.id, kind: local ? "local_business" : "company", name: c.name, domain: c.domain, website: c.website, logoUrl: c.logo_url,
    meta: [local ? c.category : c.industry ?? c.category, location(c.city, c.country, locale), size].filter(Boolean).join(" · "),
    rating: local ? c.rating : null, reviews: local ? c.reviews_count : null, bookmarked: Boolean(c.bookmarked_at),
    people: people.map((p) => ({ name: p.full_name, photoUrl: p.photo_url })),
    peopleStatus: c.people_status, peopleRequested: Boolean(c.people_requested_at),
  };
}
