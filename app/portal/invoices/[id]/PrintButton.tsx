"use client";

export function PrintButton() {
  return <button type="button" className="portal-btn secondary" onClick={() => window.print()}>طباعة / PDF</button>;
}
