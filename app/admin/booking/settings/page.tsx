import { Tx } from "@/components/bos/I18n";
import { requireAdminUser } from "@/lib/auth";
import { getBookingMeetingSettingsAdmin } from "@/services/booking-settings";
import { getBookingContent } from "@/content/booking";
import { BookingSettingsForm } from "./BookingSettingsForm";

export default async function AdminBookingPage() {
  await requireAdminUser();
  const override = await getBookingMeetingSettingsAdmin();

  const arMeeting = getBookingContent("ar").meeting;
  const enMeeting = getBookingContent("en").meeting;

  const initial = override ?? {
    title: { ar: arMeeting.title, en: enMeeting.title },
    description: { ar: arMeeting.paragraphs, en: enMeeting.paragraphs },
    location: { ar: arMeeting.platform, en: enMeeting.platform },
    durationMinutes: 30,
    allowMultipleDurations: false,
    durationOptions: [30],
  };

  return (
    <>
      <div className="admin-title-row">
        <h1><Tx>إعدادات الحجز (Application Call)</Tx></h1>
      </div>
      <BookingSettingsForm initial={initial} />
    </>
  );
}
