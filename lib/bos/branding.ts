import type { CSSProperties } from "react";
import { brandFontsAr, brandFontsEn } from "@/lib/bos/settings";

// Company branding → CSS variables on the admin/portal shell (docs/bos/35 B3).
// Components only read tokens (--bos-accent, --bos-secondary, status colours,
// --font-main), so one place applies the brand everywhere.
export interface Branding {
  brand_primary: string;
  brand_accent: string;
  brand_success: string;
  brand_warning: string;
  brand_danger: string;
  brand_info: string;
  brand_font_ar: (typeof brandFontsAr)[number];
  brand_font_en: (typeof brandFontsEn)[number];
}

const HEX = /^#[0-9a-fA-F]{6}$/;

// Readable text on a filled brand colour (WCAG relative luminance).
export function onColor(hex: string): "#ffffff" | "#111827" {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return l > 0.45 ? "#111827" : "#ffffff";
}

export function brandStyle(b: Branding, locale: "ar" | "en"): CSSProperties {
  const v: Record<string, string> = {};
  if (HEX.test(b.brand_primary)) {
    v["--red"] = b.brand_primary;
    v["--bos-accent"] = b.brand_primary;
    v["--bos-on-accent"] = onColor(b.brand_primary);
  }
  if (HEX.test(b.brand_accent)) v["--bos-secondary"] = b.brand_accent;
  for (const k of ["success", "warning", "danger", "info"] as const) {
    const c = b[`brand_${k}`];
    if (HEX.test(c)) v[`--bos-${k}`] = c;
  }
  const font = locale === "en" ? b.brand_font_en : b.brand_font_ar;
  v["--font-main"] = `"${font}", ${locale === "en" ? `"Inter", ` : `"IBM Plex Sans Arabic", `}system-ui, sans-serif`;
  return v as CSSProperties;
}

// Google Fonts stylesheet for families not already loaded by the root layout.
export function brandFontHref(b: Branding): string | null {
  const preloaded = new Set(["IBM Plex Sans Arabic", "Inter"]);
  const fams = [b.brand_font_ar, b.brand_font_en].filter((f) => !preloaded.has(f));
  if (!fams.length) return null;
  return `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700;800`).join("&")}&display=swap`;
}
