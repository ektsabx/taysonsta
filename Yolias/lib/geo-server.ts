import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { countryFromAcceptLanguage, normalizeCountry } from "@/lib/geo";

/**
 * The visitor's country: the edge's geo header (Cloudflare `cf-ipcountry`,
 * D-001), else the region in the browser language. Null when unknown.
 */
export const requestCountry = cache(async (): Promise<string | null> => {
  let h: Headers;
  try {
    h = await headers();
  } catch {
    return null; // outside a request (worker job, script)
  }
  return normalizeCountry(h.get("cf-ipcountry")) ?? countryFromAcceptLanguage(h.get("accept-language"));
});
