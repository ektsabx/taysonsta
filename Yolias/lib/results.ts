import { location } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { ProspectRow } from "@/types/database";
import type { GridPerson } from "@/components/app/PeopleGrid";

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
  };
}

/** "51–200" style size band from an employee count. */
export function sizeBand(n: number | null): string | null {
  if (n == null) return null;
  const bands: [number, string][] = [[10, "1–10"], [50, "11–50"], [200, "51–200"], [500, "201–500"], [1000, "501–1,000"], [5000, "1,001–5,000"], [10000, "5,001–10,000"]];
  for (const [max, label] of bands) if (n <= max) return label;
  return "10,000+";
}
