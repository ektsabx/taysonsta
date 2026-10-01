import { brandMarks } from "@/lib/bos/integrations/logos";

// Service logo in its brand colour; near-black marks follow the text colour so
// they stay visible in the dark theme. Falls back to initials.
function dark(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 < 0.18;
}

export function BrandLogo({ brand, name, size = 22, tile = true }: { brand: string; name?: string; size?: number; tile?: boolean }) {
  const m = brandMarks[brand];
  const svg = m ? (
    <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={m.title} style={{ fill: dark(m.hex) ? "var(--bos-strong)" : m.hex, display: "block" }}>
      <path d={m.path} />
    </svg>
  ) : <span style={{ fontWeight: 800, fontSize: size * 0.55 }}>{(name ?? brand).replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase()}</span>;
  if (!tile) return svg;
  return <span className="bos-brand-tile" style={{ width: size + 18, height: size + 18 }}>{svg}</span>;
}
