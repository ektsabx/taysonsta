import type { ReactNode } from "react";

// Every Yolias page in Admin takes the dashboard's look (owner, 2026-11-03):
// .yd-scope restyles the shared page title, number cards, cards and tables
// (app/admin/yolias-dash.css).
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return <div className="yd-scope">{children}</div>;
}
