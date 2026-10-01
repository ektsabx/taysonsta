import Image from "next/image";

// Yolias logo: the red mark (public/brand/logo-mark.png) + wordmark.
export function BrandLogo({ tone = "ink", size = 28 }: { tone?: "ink" | "light"; size?: number }) {
  return (
    <div className="brand-logo" aria-label="Yolias">
      <Image src="/brand/logo-mark.png" alt="" width={Math.round(size * 0.934)} height={size} priority />
      <span className={`brand-wordmark${tone === "light" ? " light" : ""}`}>YOLIAS</span>
    </div>
  );
}
