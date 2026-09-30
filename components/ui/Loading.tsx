import type { Dictionary } from "@/content/dictionaries";

export function Loading({ dictionary }: { dictionary: Dictionary }) {
  return (
    <div className="state-block" role="status" aria-live="polite">
      <p className="state-title">{dictionary.common.loading}</p>
    </div>
  );
}
