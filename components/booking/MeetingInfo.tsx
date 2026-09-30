import type { EffectiveMeeting } from "@/services/booking-settings";

export function MeetingInfo({ content }: { content: EffectiveMeeting }) {
  return (
    <div className="booking-meeting">
      <div className="booking-meeting-company">{content.company}</div>
      <h1 className="booking-meeting-title">{content.title}</h1>
      <div className="booking-meeting-desc">
        {content.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <div className="booking-meeting-details">
        <div className="booking-meeting-detail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" strokeLinecap="round" />
          </svg>
          <span>{content.durationLabel}: {content.duration}</span>
        </div>
        <div className="booking-meeting-detail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="2" y="6" width="14" height="12" rx="2" />
            <path d="M16 10l6-3v10l-6-3" />
          </svg>
          <span>{content.platformLabel}: {content.platform}</span>
        </div>
        <div className="booking-meeting-detail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 21c4-4 7-7.5 7-11a7 7 0 1 0-14 0c0 3.5 3 7 7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <span>{content.timezoneLabel}: {content.timezone}</span>
        </div>
      </div>
    </div>
  );
}
