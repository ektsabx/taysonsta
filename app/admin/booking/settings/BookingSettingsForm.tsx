"use client";

import { Tx } from "@/components/bos/I18n";

import { useActionState } from "react";
import type { BookingMeetingSettings } from "@/services/booking-settings";
import { saveBookingMeetingAction, type FormState } from "../actions";

interface BookingSettingsFormProps {
  initial: BookingMeetingSettings;
}

const initialState: FormState = { error: null, success: false };

export function BookingSettingsForm({ initial }: BookingSettingsFormProps) {
  const [state, formAction, pending] = useActionState(saveBookingMeetingAction, initialState);

  return (
    <form action={formAction}>
      <div className="admin-card">
        <h2><Tx>العنوان (Title)</Tx></h2>
        <div className="admin-grid-2">
          <div className="admin-field">
            <label htmlFor="titleAr"><Tx>العنوان بالعربي</Tx></label>
            <input id="titleAr" name="titleAr" defaultValue={initial.title.ar} required />
          </div>
          <div className="admin-field">
            <label htmlFor="titleEn">Title in English</label>
            <input id="titleEn" name="titleEn" defaultValue={initial.title.en} required />
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h2><Tx>الوصف (Description)</Tx></h2>
        <p style={{ fontSize: 12.5, color: "rgba(var(--bos-fg-rgb), 0.5)", marginBottom: 10 }}>
          <Tx>افصل بين الفقرات بسطر فارغ.</Tx>
        </p>
        <div className="admin-grid-2">
          <div className="admin-field">
            <label htmlFor="descriptionAr"><Tx>الوصف بالعربي</Tx></label>
            <textarea id="descriptionAr" name="descriptionAr" rows={8} defaultValue={initial.description.ar.join("\n\n")} required />
          </div>
          <div className="admin-field">
            <label htmlFor="descriptionEn">Description in English</label>
            <textarea id="descriptionEn" name="descriptionEn" rows={8} defaultValue={initial.description.en.join("\n\n")} required />
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h2><Tx>الموقع (Location)</Tx></h2>
        <div className="admin-grid-2">
          <div className="admin-field">
            <label htmlFor="locationAr"><Tx>الموقع بالعربي</Tx></label>
            <input id="locationAr" name="locationAr" defaultValue={initial.location.ar} required />
          </div>
          <div className="admin-field">
            <label htmlFor="locationEn">Location in English</label>
            <input id="locationEn" name="locationEn" defaultValue={initial.location.en} required />
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h2><Tx>المدة (Duration)</Tx></h2>
        <div className="admin-grid-2">
          <div className="admin-field">
            <label htmlFor="durationMinutes"><Tx>المدة الافتراضية (بالدقائق)</Tx></label>
            <input id="durationMinutes" name="durationMinutes" type="number" min={5} step={5} defaultValue={initial.durationMinutes} required />
          </div>
          <div className="admin-field">
            <label htmlFor="durationOptions"><Tx>مدد إضافية (اختياري، مفصولة بفاصلة)</Tx></label>
            <input
              id="durationOptions"
              name="durationOptions"
              placeholder="15, 30, 60"
              defaultValue={initial.durationOptions.join(", ")}
            />
          </div>
        </div>
        <div className="admin-checkbox-row">
          <input id="allowMultipleDurations" name="allowMultipleDurations" type="checkbox" defaultChecked={initial.allowMultipleDurations} />
          <label htmlFor="allowMultipleDurations" style={{ marginBottom: 0 }}>
            <Tx>السماح للعميل باختيار مدة المكالمة (Allow multiple durations)</Tx>
          </label>
        </div>
      </div>

      {state.error ? <p className="admin-error"><Tx>{state.error}</Tx></p> : null}
      {state.success ? <p className="admin-success"><Tx>تم الحفظ بنجاح.</Tx></p> : null}

      <button type="submit" className="admin-btn" disabled={pending}>
        <Tx>{pending ? "جارِ الحفظ..." : "حفظ"}</Tx>
      </button>
    </form>
  );
}
