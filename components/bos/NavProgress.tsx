"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// A thin bar at the top that starts the moment a link is clicked (or a GET
// form is sent) and finishes when the new page is there (owner 2026-10-21:
// clicks felt like nothing happened while the server answered). It moves the
// element directly (no re-renders) and uses no library.
function Bar({ color }: { color: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const el = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const active = useRef(false);

  const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  const set = (width: number, opacity = 1) => { if (el.current) { el.current.style.width = `${width}%`; el.current.style.opacity = String(opacity); } };
  const hide = () => { active.current = false; set(100, 0); timers.current.push(window.setTimeout(() => set(0, 0), 220)); };

  // The new page arrived: finish.
  useEffect(() => {
    if (!active.current) return;
    clear();
    hide();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hide only touches refs
  }, [pathname, search]);

  useEffect(() => {
    const start = () => {
      clear();
      active.current = true;
      set(12);
      timers.current.push(window.setTimeout(() => set(45), 120), window.setTimeout(() => set(70), 600), window.setTimeout(() => set(85), 1600));
      // Never stuck: a navigation that went nowhere (same page, blocked) hides it.
      timers.current.push(window.setTimeout(hide, 12_000));
    };
    const sameTarget = (url: URL) => url.pathname === window.location.pathname && url.search === window.location.search;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || sameTarget(url)) return;
      start();
    };
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form || e.defaultPrevented || (form.method || "get").toLowerCase() !== "get" || !form.action) return;
      if (new URL(form.action, window.location.href).origin === window.location.origin) start();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => { document.removeEventListener("click", onClick, true); document.removeEventListener("submit", onSubmit, true); clear(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once; the helpers only touch refs
  }, []);

  return (
    <div ref={el} aria-hidden="true" style={{ position: "fixed", insetInlineStart: 0, top: 0, height: 2, width: 0, background: color, zIndex: 9999, opacity: 0, transition: "width 200ms ease, opacity 200ms ease", pointerEvents: "none" }} />
  );
}

export function NavProgress({ color = "var(--red)" }: { color?: string }) {
  return <Suspense fallback={null}><Bar color={color} /></Suspense>;
}
