import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type Faq = Database["public"]["Tables"]["faqs"]["Row"];

export async function getFaqs(): Promise<Faq[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faqs")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}
