import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_KEYS, listingOf, type AppKey, type AppListing } from "@/lib/app-listings";

/** What Yolias Admin set for every integration (site_settings "app_listings"). */
export async function appListings(locale: "en" | "ar"): Promise<Record<AppKey, AppListing>> {
  const { data } = await createAdminClient().from("site_settings").select("value").eq("key", "app_listings").maybeSingle();
  return Object.fromEntries(APP_KEYS.map((k) => [k, listingOf(k, data?.value, locale)])) as Record<AppKey, AppListing>;
}
