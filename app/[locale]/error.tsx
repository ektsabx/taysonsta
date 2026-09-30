"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { getDictionary } from "@/content/dictionaries";
import { defaultLocale } from "@/lib/i18n";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const dictionary = getDictionary(defaultLocale);

  return <ErrorState dictionary={dictionary} onRetry={reset} />;
}
