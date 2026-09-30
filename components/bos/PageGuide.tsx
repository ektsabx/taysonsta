"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useLocale, useT } from "@/components/bos/I18n";
import { guideFor } from "@/lib/bos/page-guides";

// Contextual page guide (docs/bos/35 B2). A frosted (blurred) side panel with
// the page's purpose, owner and steps. It never covers the work area with a
// scrim: the page stays readable and usable while the guide is open.
export function PageGuideButton() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useT();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const guide = guideFor(pathname);
  const open = openFor === pathname;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenFor(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!guide) return null;
  const g = guide[locale === "en" ? "en" : "ar"];
  return (
    <>
      <button type="button" className="admin-icon-btn bos-guide-btn" aria-expanded={open} aria-label={t("دليل الصفحة")} title={t("دليل الصفحة")} onClick={() => setOpenFor(open ? null : pathname)}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M9.5 9.2a2.6 2.6 0 0 1 5 1c0 1.8-2.5 2.2-2.5 3.8M12 17.2h.01" /></svg>
      </button>
      {open ? createPortal(
        <aside className="bos-guide-panel" role="complementary" aria-label={t("دليل الصفحة")}>
          <div className="bos-guide-head">
            <span className="bos-guide-kicker">{t("دليل الصفحة")}</span>
            <button type="button" className="bos-icon-btn" aria-label={t("إغلاق")} onClick={() => setOpenFor(null)}>×</button>
          </div>
          <h2>{g.title}</h2>
          <dl>
            <dt>{t("الوظيفة")}</dt><dd>{g.purpose}</dd>
            <dt>{t("المسؤول")}</dt><dd>{g.owner}</dd>
          </dl>
          <div className="bos-guide-steps-title">{t("طريقة الاستخدام")}</div>
          <ol>{g.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </aside>,
        // Outside the header: its backdrop-filter would stop the panel's blur.
        document.querySelector(".admin-shell") ?? document.body,
      ) : null}
    </>
  );
}
