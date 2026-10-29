import type { Localized } from "./types";

// Copy for the public status page (/status, D-181).
export const statusCopy: Localized<{
  title: string; seoTitle: string; metaDescription: string; updated: string; never: string;
  overall: Record<string, string>; labels: Record<string, string>;
  uptime: string; noHistory: string; daysAgo: string; today: string; legendTitle: string; noDataDay: string;
  activeTitle: string; upcomingTitle: string; pastTitle: string; noIncidents: string; affects: string; scheduled: string;
  incidentStatus: Record<string, string>; how: string; contact: string;
}> = {
  en: {
    title: "Yolias Status",
    seoTitle: "Yolias Status: Service Availability and Incidents",
    metaDescription: "Live availability of Yolias services, measured every few minutes, with current incidents, scheduled maintenance and incident history.",
    updated: "Last checked {time}",
    never: "No checks yet",
    overall: {
      operational: "All systems operational",
      maintenance: "Scheduled maintenance in progress",
      degraded: "Some services are slower than usual",
      partial_outage: "Some services are partly unavailable",
      major_outage: "Some services are unavailable",
      no_data: "Status data isn’t available right now",
    },
    labels: { operational: "Operational", maintenance: "Maintenance", degraded: "Degraded performance", partial_outage: "Partial outage", major_outage: "Major outage", no_data: "No recent data" },
    uptime: "{pct}% uptime",
    noHistory: "No history yet",
    daysAgo: "90 days ago",
    today: "Today",
    legendTitle: "How to read the bars",
    noDataDay: "No data",
    activeTitle: "Current incidents",
    upcomingTitle: "Scheduled maintenance",
    pastTitle: "Past incidents (14 days)",
    noIncidents: "No incidents in the last 14 days.",
    affects: "Affects: {list}",
    scheduled: "{from} to {to}",
    incidentStatus: { investigating: "Investigating", identified: "Identified", monitoring: "Monitoring", resolved: "Resolved", scheduled: "Scheduled", in_progress: "In progress", completed: "Completed" },
    how: "Each service is checked automatically every few minutes; one failed check alone isn’t shown as an outage. Incidents and maintenance are posted by the Yolias team.",
    contact: "Having trouble that isn’t listed here? Contact support.",
  },
  ar: {
    title: "حالة خدمات يولياس",
    seoTitle: "حالة خدمات يولياس: التوفر والأعطال",
    metaDescription: "توفر خدمات يولياس مباشرةً، بقياس كل بضع دقائق، مع الأعطال الحالية والصيانة المجدولة وسجل الأعطال.",
    updated: "آخر فحص {time}",
    never: "لم يتم أي فحص بعد",
    overall: {
      operational: "كل الخدمات تعمل بشكل طبيعي",
      maintenance: "صيانة مجدولة جارية",
      degraded: "بعض الخدمات أبطأ من المعتاد",
      partial_outage: "بعض الخدمات متوقفة جزئيًا",
      major_outage: "بعض الخدمات متوقفة",
      no_data: "بيانات الحالة غير متاحة الآن",
    },
    labels: { operational: "تعمل", maintenance: "صيانة", degraded: "أداء أبطأ", partial_outage: "توقف جزئي", major_outage: "توقف كامل", no_data: "لا توجد بيانات حديثة" },
    uptime: "نسبة التوفر {pct}%",
    noHistory: "لا يوجد سجل بعد",
    daysAgo: "قبل 90 يومًا",
    today: "اليوم",
    legendTitle: "كيف تقرأ الأشرطة",
    noDataDay: "لا توجد بيانات",
    activeTitle: "أعطال حالية",
    upcomingTitle: "صيانة مجدولة",
    pastTitle: "أعطال سابقة (14 يومًا)",
    noIncidents: "لا توجد أعطال خلال آخر 14 يومًا.",
    affects: "تؤثر على: {list}",
    scheduled: "من {from} إلى {to}",
    incidentStatus: { investigating: "قيد التحقق", identified: "تم تحديد السبب", monitoring: "تحت المراقبة", resolved: "تم الحل", scheduled: "مجدولة", in_progress: "جارية", completed: "اكتملت" },
    how: "تُفحص كل خدمة تلقائيًا كل بضع دقائق، ولا يُعرض فحص فاشل واحد كعطل. ينشر فريق يولياس الأعطال والصيانة.",
    contact: "تواجه مشكلة غير مذكورة هنا؟ تواصل مع الدعم.",
  },
};
