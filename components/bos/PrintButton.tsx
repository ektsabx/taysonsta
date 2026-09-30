"use client";

import { Tx } from "@/components/bos/I18n";

// Browser print → "Save as PDF" (payslips, letters).
export function PrintButton({ label = "طباعة" }: { label?: string }) {
  return <button type="button" className="admin-btn small secondary" onClick={() => window.print()}><Tx>{label}</Tx></button>;
}
