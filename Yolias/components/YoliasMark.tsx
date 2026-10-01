// The Yolias mark drawn as SVG (six ring segments + centre) so it can animate
// while Yolias AI is thinking — the way Claude animates its own mark.
const segments = [
  "54.8,4.8 86.8,23.3 69.8,34.4 53.6,25.1",
  "91.6,31.5 91.6,68.5 73.4,59.4 73.4,40.6",
  "86.8,76.8 54.8,95.3 53.6,74.9 69.8,65.6",
  "45.2,95.3 13.2,76.8 30.2,65.6 46.4,74.9",
  "8.4,68.5 8.4,31.5 26.6,40.6 26.6,59.4",
  "13.2,23.2 45.2,4.8 46.4,25.1 30.2,34.4",
];

export function YoliasMark({ size = 20, thinking = false, className = "" }: { size?: number; thinking?: boolean; className?: string }) {
  return (
    <svg
      className={`yolias-mark${thinking ? " thinking" : ""}${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      {segments.map((points, i) => (
        <polygon key={points} points={points} style={{ animationDelay: `${i * 0.16}s` }} />
      ))}
      <circle cx="50" cy="50" r="12" />
    </svg>
  );
}

/** "Yolias is thinking…" row shown while Yolias AI works. */
export function YoliasThinking({ label }: { label: string }) {
  return (
    <div className="yolias-thinking" role="status" aria-live="polite">
      <YoliasMark size={22} thinking />
      <span className="shimmer-text">{label}</span>
    </div>
  );
}
