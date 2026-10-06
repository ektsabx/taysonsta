import type { Dictionary } from "@/lib/i18n/config";

const keys = {
  link_invalid: "linkInvalid",
  link_missing: "linkMissing",
  google_failed: "googleFailed",
  account_unavailable: "accountUnavailable",
} as const;

export async function errorFrom(searchParams: Promise<Record<string, string | string[] | undefined>>, t: Dictionary) {
  const sp = await searchParams;
  const k = typeof sp.error === "string" ? keys[sp.error as keyof typeof keys] : undefined;
  return k ? t.auth.errors[k] : undefined;
}
