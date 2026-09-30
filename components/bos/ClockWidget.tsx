"use client";

import { Tx } from "@/components/bos/I18n";
import { nowMs } from "@/lib/bos/clock";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clockInAction, clockOutAction, endBreakAction, startBreakAction } from "@/app/admin/team/attendance/actions";
import { recordLocationAction, shouldShareLocationAction } from "@/app/admin/team/locations/actions";

// Location is shared only right after the employee's own clock action, only
// with their consent, and only if the browser grants permission (docs/bos/30 §28).
async function shareLocation(event: "clock_in" | "clock_out") {
  if (typeof navigator === "undefined" || !navigator.geolocation) return;
  if (!(await shouldShareLocationAction())) return;
  navigator.geolocation.getCurrentPosition(
    (p) => { void recordLocationAction(event, p.coords.latitude, p.coords.longitude, p.coords.accuracy ?? null); },
    () => undefined, // denied/unavailable: nothing is recorded
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
  );
}

function elapsed(from: string | null, now: number): string {
  if (!from) return "00:00:00";
  const s = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

export interface ClockProps {
  clockInAt: string | null;
  onBreak: boolean;
  staleOpenSession: boolean;
  workedMinutesToday: number;
}

function useNow() {
  const [now, setNow] = useState(() => nowMs());
  useEffect(() => {
    const t = setInterval(() => setNow(nowMs()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function useClockActions() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, event?: "clock_in" | "clock_out") =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "تعذر تنفيذ الإجراء");
      else {
        setError(null);
        if (event) void shareLocation(event);
        router.refresh();
      }
    });
  const isMobile = () => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches;
  const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    pending,
    error,
    clockIn: () => run(() => clockInAction(isMobile() ? "mobile" : "web", tz()), "clock_in"),
    clockOut: () => run(() => clockOutAction(isMobile() ? "mobile" : "web"), "clock_out"),
    startBreak: () => run(() => startBreakAction()),
    endBreak: () => run(() => endBreakAction()),
  };
}

// Compact header version.
export function HeaderClock({ clockInAt, onBreak, staleOpenSession }: ClockProps) {
  const now = useNow();
  const { pending, error, clockIn, clockOut } = useClockActions();
  return (
    <div className="bos-clock" title={error ?? undefined}>
      {clockInAt ? (
        <>
          <Link href="/admin/team/attendance/me" className="bos-clock-timer">
            {onBreak ? "استراحة · " : staleOpenSession ? "جلسة سابقة مفتوحة · " : ""}
            <span suppressHydrationWarning>{elapsed(clockInAt, now)}</span>
          </Link>
          <button type="button" className="admin-btn small danger" onClick={clockOut} disabled={pending} aria-busy={pending}>
            END WORK
          </button>
        </>
      ) : (
        <button type="button" className="admin-btn small success" onClick={clockIn} disabled={pending} aria-busy={pending}>
          START WORK
        </button>
      )}
      {error ? <span className="bos-field-error" style={{ maxWidth: 200 }}><Tx>{error}</Tx></span> : null}
    </div>
  );
}

// Large version for dashboard / My Attendance / mobile (§30, §68).
export function ClockCard({ clockInAt, onBreak, staleOpenSession, workedMinutesToday }: ClockProps) {
  const now = useNow();
  const { pending, error, clockIn, clockOut, startBreak, endBreak } = useClockActions();
  return (
    <div className="bos-clock-big">
      <div className="bos-row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="bos-faint" style={{ fontSize: 12 }}><Tx>{clockInAt ? (onBreak ? "في استراحة" : "الجلسة الحالية") : "غير مسجل حضور"}</Tx></div>
          <div className="timer">{elapsed(clockInAt, now)}</div>
        </div>
        <div className="bos-faint" style={{ fontSize: 12, textAlign: "end" }}>
          <Tx>مسجّل اليوم</Tx>
          <div className="bos-num" style={{ fontSize: 15, color: "var(--bos-strong)", fontWeight: 700 }}>
            {Math.floor(workedMinutesToday / 60)}h {String(workedMinutesToday % 60).padStart(2, "0")}m
          </div>
        </div>
      </div>
      {staleOpenSession ? (
        <div className="bos-form-error"><Tx>لديك جلسة عمل مفتوحة من يوم سابق. أنهِها ثم اطلب تصحيحاً إذا لزم.</Tx></div>
      ) : null}
      {clockInAt ? (
        <>
          <button type="button" className="admin-btn danger" onClick={clockOut} disabled={pending} aria-busy={pending}>
            END WORK
          </button>
          <button type="button" className="admin-btn secondary" onClick={onBreak ? endBreak : startBreak} disabled={pending} style={{ height: 40 }}>
            <Tx>{onBreak ? "إنهاء الاستراحة" : "بدء استراحة"}</Tx>
          </button>
        </>
      ) : (
        <button type="button" className="admin-btn success" onClick={clockIn} disabled={pending} aria-busy={pending}>
          START WORK
        </button>
      )}
      {error ? <div className="bos-form-error"><Tx>{error}</Tx></div> : null}
    </div>
  );
}
