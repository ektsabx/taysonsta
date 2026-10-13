"use client";

import { useRouter } from "next/navigation";

// A dropdown filter that lives in the URL (used instead of chip rows, like
// "Sort by" and "Owner"). `base` is the page URL with the other params.
export function StatusFilter({ param, base, value, label, options }: { param: string; base: string; value: string; label: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const go = (v: string) => {
    const url = new URL(base, "http://x");
    if (v) url.searchParams.set(param, v);
    else url.searchParams.delete(param);
    url.searchParams.delete("page");
    router.push(`${url.pathname}${url.search}`);
  };
  return (
    <select className="form-select" aria-label={label} value={value} onChange={(e) => go(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{label}: {o.label}</option>)}
    </select>
  );
}
