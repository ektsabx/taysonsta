import type { ReactNode } from "react";

// A CSV download from an /api/bos/export route. A plain <a> on purpose:
// it's a file download, not a page (next/link would try to route to it).
export function ExportLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="admin-btn small ghost" href={href} download>
      {children}
    </a>
  );
}
