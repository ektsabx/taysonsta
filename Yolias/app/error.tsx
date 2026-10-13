"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { isNetworkError } from "@/lib/action-client";
import { ErrorScreen } from "@/components/ErrorScreen";
import { useI18n } from "@/lib/i18n/client";

// Shown when a page throws; the rest of the app keeps working.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  const e = t.errorPages;
  const router = useRouter();
  // A dropped connection (mobile, long sessions: YOLIAS-7/A) is not a page
  // defect: say so, and retry by fetching the page again.
  const network = isNetworkError(error);
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error, network ? { level: "warning", tags: { network: "true" } } : undefined);
  }, [error, network]);
  return (
    <ErrorScreen
      title={network ? e.networkTitle : e.errorTitle}
      body={network ? e.networkBody : e.errorBody}
      primary={{ label: e.retry, onClick: () => { router.refresh(); reset(); } }}
      secondary={{ label: e.contact, href: "/contact?topic=support" }}
    />
  );
}
