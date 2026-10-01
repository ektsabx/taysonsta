"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";

export interface SearchItem {
  slug: string;
  title: string;
  summary: string;
}

// Search box + live results over all Help Center articles.
export function HelpSearch({ items }: { items: SearchItem[] }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const results = useMemo(
    () => (q ? items.filter((a) => `${a.title} ${a.summary}`.toLowerCase().includes(q)) : []),
    [items, q]
  );

  return (
    <div className="help-search">
      <Search />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.help.searchPlaceholder}
        aria-label={t.help.searchPlaceholder}
      />
      {q && (
        <div className="article-list mt-4 rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 text-start">
          {results.length === 0 && <p className="py-4 text-sm text-[var(--muted)]">{fmt(t.help.noResults, { query })}</p>}
          {results.map((a) => (
            <Link key={a.slug} href={`/help-center/${a.slug}`} className="article-link">
              <div>
                <strong>{a.title}</strong>
                <span>{a.summary}</span>
              </div>
              <ChevronRight className="flip-rtl" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
