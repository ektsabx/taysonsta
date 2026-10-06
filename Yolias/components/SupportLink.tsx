"use client";

import type { ReactNode } from "react";

declare global {
  interface Window {
    bosWidget?: { open(): void; close(): void; toggle(): void };
  }
}

/** Opens the support chat widget (D-140); a normal link to the contact page when it isn't available. */
export function openSupport(): boolean {
  if (typeof window === "undefined" || !window.bosWidget) return false;
  window.bosWidget.open();
  return true;
}

export function SupportLink({ className, children, onOpen, role }: { className?: string; children: ReactNode; onOpen?: () => void; role?: string }) {
  return (
    <a
      href="/contact?topic=support"
      className={className}
      role={role}
      onClick={(e) => {
        if (openSupport()) {
          e.preventDefault();
          onOpen?.();
        }
      }}
    >
      {children}
    </a>
  );
}
