// In-app notifications (owner, 2026-10-19): one language (English), plain
// text like Claude's — no emoji and no dashes. Used when a notice is written
// and again when it's shown (older notices).

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}]/gu;

export function cleanNotificationText(text: string): string {
  return text
    .replace(EMOJI, "")
    .replace(/\s+[—–-]+\s+/g, ", ")
    .replace(/[—–]/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,:]+|[\s,:]+$/g, "")
    .trim();
}

/** "now", "5m", "3h", "2d", or a short date — always English. */
export function notificationTime(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
}
