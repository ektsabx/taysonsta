"use client";

import { Tx } from "@/components/bos/I18n";

import { useState, useTransition } from "react";
import type { Booking } from "@/services/booking-admin";
import type { BookingStatus } from "@/types/database";
import { updateBookingStatusAction } from "../actions";

const statusOptions: { value: BookingStatus; label: string }[] = [
  { value: "pending", label: "قيد الانتظار" },
  { value: "confirmed", label: "مؤكد" },
  { value: "unqualified", label: "غير مؤهل" },
  { value: "cancelled", label: "ملغي" },
];

export function BookingStatusPanel({ booking }: { booking: Booking }) {
  const [status, setStatus] = useState<BookingStatus>(booking.status);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await updateBookingStatusAction(booking.id, status);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="admin-card">
      <h2><Tx>الحالة</Tx></h2>

      <div className="admin-field">
        <label htmlFor="status"><Tx>حالة الحجز</Tx></label>
        <select id="status" value={status} onChange={(e) => setStatus(e.target.value as BookingStatus)}>
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <button type="button" className="admin-btn" disabled={isPending} onClick={handleSave}>
        <Tx>{isPending ? "جارِ الحفظ..." : "حفظ"}</Tx>
      </button>
      {saved ? <p className="admin-success"><Tx>تم الحفظ.</Tx></p> : null}
      {error ? <p className="admin-error"><Tx>{error}</Tx></p> : null}
    </div>
  );
}
