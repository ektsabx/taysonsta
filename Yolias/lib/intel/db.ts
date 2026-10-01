import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

// The `intel` schema is service-role only (docs/08). Never call this with
// data from a request before the caller's access was checked.
export function intel() {
  return createAdminClient().schema("intel");
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await intel().from("settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T | undefined) ?? fallback;
}

export const asJson = (v: unknown) => v as Json;
