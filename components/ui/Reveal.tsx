"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
}

type RevealState = "unset" | "pending" | "visible";

export function Reveal({ children }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RevealState>("unset");

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const alreadyInView = rect.top < window.innerHeight - 60 && rect.bottom > 0;

    if (alreadyInView) {
      setState("visible");
      return;
    }

    setState("pending");

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setState("visible");
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const modifier = state === "pending" ? " reveal-pending" : state === "visible" ? " reveal-visible" : "";

  return (
    <div ref={ref} className={`reveal${modifier}`}>
      {children}
    </div>
  );
}
