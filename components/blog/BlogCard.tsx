import Link from "next/link";
import Image from "next/image";
import type { BlogListItem } from "@/services/blog";
import type { Dictionary } from "@/content/dictionaries";
import { localizedPath, type Locale } from "@/lib/i18n";
import { storageUrl } from "@/lib/storage";

interface BlogCardProps {
  post: BlogListItem;
  locale: Locale;
  dictionary: Dictionary;
}

export function BlogCard({ post, locale, dictionary }: BlogCardProps) {
  const title = locale === "ar" ? post.title_ar : post.title_en;
  const excerpt = locale === "ar" ? post.excerpt_ar : post.excerpt_en;
  const categoryName = post.blog_categories ? (locale === "ar" ? post.blog_categories.name_ar : post.blog_categories.name_en) : null;

  return (
    <Link href={localizedPath(locale, `/blogs/${post.slug}`)} className="blog-card">
      {post.featured_image ? (
        <div className="blog-card-media">
          <Image src={storageUrl(post.featured_image)} alt={title} width={480} height={300} />
        </div>
      ) : null}
      <div className="blog-card-body">
        {categoryName ? <span className="blog-card-category">{categoryName}</span> : null}
        <h3 className="blog-card-title">{title}</h3>
        {excerpt ? <p className="blog-card-excerpt">{excerpt}</p> : null}
        {post.reading_time_minutes ? (
          <span className="blog-card-meta">{dictionary.blog.readingTime(post.reading_time_minutes)}</span>
        ) : null}
      </div>
    </Link>
  );
}
