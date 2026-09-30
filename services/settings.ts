import { createClient } from "@/lib/supabase/server";

export async function getSiteSetting<T>(key: string): Promise<T | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data?.value as T) ?? null;
}

export interface LocalizedText {
  ar: string;
  en: string;
}
