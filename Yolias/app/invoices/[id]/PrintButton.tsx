"use client";

import { Download } from "lucide-react";

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn-secondary invoice-print" onClick={() => window.print()}>
      <Download /> {label}
    </button>
  );
}
