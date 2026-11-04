"use client";

import { AtSign } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { GmailIcon, GoogleCalendarIcon } from "@/components/app/ConnectorIcons";
import { mailboxState, type EmailState } from "@/app/(app)/settings/mailbox-actions";
import { calendarState } from "@/app/(app)/settings/calendar-actions";
import type { AppKey } from "@/lib/app-listings";

export type CalendarState = Awaited<ReturnType<typeof calendarState>>;

export function AppLogo({ app }: { app: AppKey }) {
  return (
    <span className="app-logo">
      {app === "gmail" ? <GmailIcon /> : app === "google-calendar" ? <GoogleCalendarIcon /> : app === "imap" ? <AtSign />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src="/integrations/pixel-helper-icon.png" alt="" />}
    </span>
  );
}

/** Who is connected, for the store and the detail page. */
export function useAppState() {
  const [mail, setMail] = useState<EmailState | null>(null);
  const [cal, setCal] = useState<CalendarState | null>(null);
  const load = useCallback(() => { void mailboxState().then(setMail).catch(() => setMail(null)); void calendarState().then(setCal).catch(() => setCal(null)); }, []);
  useEffect(() => { load(); }, [load]);
  const boxes = (mail?.mailboxes ?? []).filter((m) => m.status !== "disconnected");
  const connected = (app: AppKey) => (app === "gmail" || app === "imap" ? boxes.filter((m) => m.provider === app).length : app === "google-calendar" ? (cal?.connection ? 1 : 0) : 0);
  const canConnect = (app: AppKey) => (app === "gmail" ? Boolean(mail?.available.includes("gmail")) : app === "google-calendar" ? Boolean(cal?.available) : true);
  return { ready: Boolean(mail && cal), cal, connected, canConnect, load };
}

/** Google's consent screen is an API route that redirects: a full page load. */
export const startUrl = (app: AppKey) => (app === "gmail" ? "/api/integrations/gmail/start" : app === "google-calendar" ? "/api/calendar/google/start" : null);
