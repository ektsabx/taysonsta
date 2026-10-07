"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorScreen } from "@/components/ErrorScreen";
import { useI18n } from "@/lib/i18n/client";

// Shown when a page throws; the rest of the app keeps working.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  const e = t.errorPages;
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);
  return (
    <ErrorScreen
      title={e.errorTitle}
      body={e.errorBody}
      primary={{ label: e.retry, onClick: reset }}
      secondary={{ label: e.contact, href: "/contact?topic=support" }}
    />
  );
}
