import { getBookingContent } from "@/content/booking";
import { bookingServices, type BookingServiceId } from "@/content/booking-services";
import { getEffectiveMeetingContent } from "@/services/booking-settings";
import type { Locale } from "@/lib/i18n";
import { MeetingInfo } from "./MeetingInfo";
import { BookingShell } from "./BookingShell";

export async function BookingPageContent({ locale, serviceId }: { locale: Locale; serviceId: BookingServiceId }) {
  const content = getBookingContent(locale);
  const baseMeeting = await getEffectiveMeetingContent(locale);
  const service = bookingServices[serviceId];
  const meeting = service.meetingParagraphs ? { ...baseMeeting, paragraphs: service.meetingParagraphs(locale) } : baseMeeting;

  return (
    <div className="booking-page">
      <MeetingInfo content={meeting} />
      <BookingShell content={content} meeting={meeting} locale={locale} serviceId={serviceId} />
    </div>
  );
}
