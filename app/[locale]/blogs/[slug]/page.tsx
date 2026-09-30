import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { isLocale, localizedPath, type Locale } from "@/lib/i18n";
import { getBlogBySlug } from "@/services/blog";
import { PageTopSpacer } from "@/components/ui/PageTopSpacer";
import { storageUrl } from "@/lib/storage";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : "ar";
  const post = await getBlogBySlug(slug);

  if (!post) {
    return {};
  }

  const title = locale === "ar" ? post.title_ar : post.title_en;
  const description = (locale === "ar" ? post.excerpt_ar : post.excerpt_en) ?? undefined;
  const canonical = localizedPath(locale, `/blogs/${post.slug}`);

  return {
    title: `${title} - Taysonsta`,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      images: post.featured_image ? [storageUrl(post.featured_image)] : undefined,
      type: "article",
      publishedTime: post.published_at ?? undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: post.featured_image ? [storageUrl(post.featured_image)] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { locale: localeParam, slug } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const post = await getBlogBySlug(slug);

  if (!post) {
    notFound();
  }

  const title = locale === "ar" ? post.title_ar : post.title_en;
  const content = locale === "ar" ? post.content_ar : post.content_en;
  const categoryName = post.blog_categories ? (locale === "ar" ? post.blog_categories.name_ar : post.blog_categories.name_en) : null;

  return (
    <>
    <PageTopSpacer />
    <section className="sec">
      <div className="blog-post-hero">
        {categoryName ? <div className="blog-post-category">{categoryName}</div> : null}
        <h1 className="blog-post-title">{title}</h1>
        {post.featured_image ? (
          <div className="blog-post-media">
            <Image src={storageUrl(post.featured_image)} alt={title} width={760} height={428} />
          </div>
        ) : null}
      </div>
      <div className="blog-post-body">{content}</div>
    </section>
    </>
  );
}
