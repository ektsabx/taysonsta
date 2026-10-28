"use client";

import { useI18n } from "@/lib/i18n/client";

// "Share on" buttons under a referral or invite link (owner, 2026-10-28):
// each opens a new post on that network with a short line about Yolias and
// the link. Plain share URLs, no SDKs or tracking scripts. Facebook takes the
// link only (it ignores prefilled text).
const NETWORKS = ["whatsapp", "facebook", "linkedin", "telegram", "x"] as const;
type Network = (typeof NETWORKS)[number];
const NAMES: Record<Network, string> = { whatsapp: "WhatsApp", facebook: "Facebook", linkedin: "LinkedIn", telegram: "Telegram", x: "X" };

export function shareUrl(network: Network, link: string, text: string): string {
  const e = encodeURIComponent;
  switch (network) {
    case "whatsapp": return `https://wa.me/?text=${e(`${text}\n${link}`)}`;
    case "facebook": return `https://www.facebook.com/sharer/sharer.php?u=${e(link)}`;
    case "linkedin": return `https://www.linkedin.com/feed/?shareActive=true&text=${e(`${text} ${link}`)}`;
    case "telegram": return `https://t.me/share/url?url=${e(link)}&text=${e(text)}`;
    case "x": return `https://twitter.com/intent/tweet?text=${e(text)}&url=${e(link)}`;
  }
}

export function ShareButtons({ link, text }: { link: string; text?: string }) {
  const { t } = useI18n();
  const s = t.share;
  const message = text ?? s.message;
  return (
    <div className="share-row">
      <span className="share-label">{s.on}</span>
      <div className="share-buttons">
        {NETWORKS.map((n) => (
          <a key={n} className={`share-btn ${n}`} href={shareUrl(n, link, message)} target="_blank" rel="noopener noreferrer">{NAMES[n]}</a>
        ))}
      </div>
    </div>
  );
}
