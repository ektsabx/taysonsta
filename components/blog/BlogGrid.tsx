import type { BlogListItem } from "@/services/blog";
import type { Dictionary } from "@/content/dictionaries";
import type { Locale } from "@/lib/i18n";
import { BlogCard } from "./BlogCard";

interface BlogGridProps {
  posts: BlogListItem[];
  locale: Locale;
  dictionary: Dictionary;
}

export function BlogGrid({ posts, locale, dictionary }: BlogGridProps) {
  const colsClass = posts.length === 1 ? " cols-1" : posts.length === 2 ? " cols-2" : "";

  return (
    <div className={`blog-grid${colsClass}`}>
      {posts.map((post) => (
        <BlogCard key={post.id} post={post} locale={locale} dictionary={dictionary} />
      ))}
    </div>
  );
}
