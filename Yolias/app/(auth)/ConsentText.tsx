import Link from "next/link";
import type { ReactNode } from "react";

// Renders a consent sentence whose {placeholders} become links that open in a
// new tab (sign-up and partner join, owner brief 2026-10-19).
export function ConsentText({ text, links }: { text: string; links: Record<string, { href: string; label: string }> }) {
  const parts: ReactNode[] = [];
  text.split(/(\{\w+\})/).forEach((chunk, i) => {
    const key = chunk.match(/^\{(\w+)\}$/)?.[1];
    const link = key ? links[key] : undefined;
    parts.push(link ? <Link key={i} href={link.href} target="_blank" rel="noopener">{link.label}</Link> : chunk);
  });
  return <span>{parts}</span>;
}
