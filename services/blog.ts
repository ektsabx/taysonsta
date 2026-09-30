import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type BlogRow = Database["public"]["Tables"]["blogs"]["Row"];
export type BlogCategoryRow = Database["public"]["Tables"]["blog_categories"]["Row"];
export type AuthorRow = Database["public"]["Tables"]["authors"]["Row"];

export interface BlogListItem extends BlogRow {
  blog_categories: BlogCategoryRow | null;
  authors: AuthorRow | null;
}

export async function getPublishedBlogs(): Promise<BlogListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blogs")
    .select("*, blog_categories(*), authors(*)")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as BlogListItem[]) ?? [];
}

export async function getBlogBySlug(slug: string): Promise<BlogListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blogs")
    .select("*, blog_categories(*), authors(*)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as BlogListItem | null;
}
