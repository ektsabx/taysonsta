import "server-only";
import { getSetting } from "@/lib/bos/settings";
import { currencyForCountry, type Currency } from "@/lib/bos/currency";

// Default currency for new records: the company's country decides (Egypt →
// EGP, everyone else → USD). A record for a known client uses the client's
// country instead (currencyForCountry).
export async function defaultCurrency(): Promise<Currency> {
  const company = await getSetting("company");
  return currencyForCountry(company.country);
}
