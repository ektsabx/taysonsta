import type { Locale } from "@/lib/i18n/config";

// A real Yolias screen (public/screens, captured from the app with sample
// data), in the visitor's language and theme. Both theme images are in the
// page; CSS shows the one that matches html[data-theme].
export function ProductShot({ name, locale, alt, caption, priority = false }: { name: "search" | "prospects"; locale: Locale; alt: string; caption?: string; priority?: boolean }) {
  const src = (theme: "light" | "dark") => `/screens/${name}-${locale}-${theme}.jpg`;
  const loading = priority ? "eager" : "lazy";
  return (
    <figure className="product-shot">
      <div className="product-shot-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="shot-light" src={src("light")} alt={alt} width={1440} height={900} loading={loading} decoding="async" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="shot-dark" src={src("dark")} alt={alt} width={1440} height={900} loading={loading} decoding="async" />
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
