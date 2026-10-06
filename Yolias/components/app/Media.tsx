"use client";

import { useState } from "react";
import { initials } from "@/lib/format";

// Company logos and people's photos on result cards (D-147). A provider
// image when there is one, else the company's domain icon, else initials
// on a colour picked from the name.

const PALETTE = ["#1f2937", "#7c3aed", "#0f766e", "#b45309", "#be123c", "#1d4ed8", "#4d7c0f", "#9333ea"];
const colour = (s: string) => PALETTE[[...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % PALETTE.length];

function Fallback({ name, size, round }: { name: string; size: number; round: boolean }) {
  return (
    <span className={`media-fallback${round ? " round" : ""}`} style={{ width: size, height: size, background: colour(name), fontSize: Math.max(11, size * 0.36) }} aria-hidden="true">
      {initials(name, name.slice(0, 2).toUpperCase())}
    </span>
  );
}

export function CompanyLogo({ name, logoUrl, domain, size = 44 }: { name: string; logoUrl?: string | null; domain?: string | null; size?: number }) {
  const sources = [logoUrl, domain ? `/api/logo/${encodeURIComponent(domain)}` : null].filter(Boolean) as string[];
  const [i, setI] = useState(0);
  if (i >= sources.length) return <Fallback name={name} size={size} round={false} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="media-logo" src={sources[i]} alt="" width={size} height={size} style={{ width: size, height: size }} loading="lazy" onError={() => setI(i + 1)} />
  );
}

export function PersonAvatar({ name, photoUrl, size = 44 }: { name: string; photoUrl?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!photoUrl || failed) return <Fallback name={name} size={size} round />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="media-avatar" src={photoUrl} alt="" width={size} height={size} style={{ width: size, height: size }} loading="lazy" onError={() => setFailed(true)} />;
}

/** Up to `max` overlapping faces (+N). */
export function AvatarStack({ people, max = 4, size = 26 }: { people: { name: string; photoUrl?: string | null }[]; max?: number; size?: number }) {
  return (
    <span className="avatar-stack">
      {people.slice(0, max).map((p, k) => <PersonAvatar key={k} name={p.name} photoUrl={p.photoUrl} size={size} />)}
      {people.length > max && <span className="avatar-more" style={{ height: size, minWidth: size }}>+{people.length - max}</span>}
    </span>
  );
}
