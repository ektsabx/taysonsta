import { getT } from "@/lib/bos/i18n/server";
import { Tx, Opt } from "@/components/bos/I18n";
import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { getBookingsStatsAdmin, listBookingsAdmin } from "@/services/booking-admin";
import { bookingServiceIds, bookingServices } from "@/content/booking-services";
import type { BookingStatus } from "@/types/database";

const statusLabels: Record<BookingStatus, string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  unqualified: "غير مؤهل",
  cancelled: "ملغي",
};

const statusBadgeClass: Record<BookingStatus, string> = {
  pending: "pending",
  confirmed: "confirmed",
  unqualified: "unqualified",
  cancelled: "cancelled",
};

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    service?: string;
    from?: string;
    to?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function AdminBookingsPage({ searchParams }: PageProps) {
  const t = await getT();
  await requireAdminUser();
  const { q, status, service, from, to, sort, page } = await searchParams;

  const stats = await getBookingsStatsAdmin();
  const result = await listBookingsAdmin({
    search: q || undefined,
    status: (status as BookingStatus) || undefined,
    service: service || undefined,
    from: from || undefined,
    to: to || undefined,
    sort: (sort as "scheduled_asc" | "scheduled_desc" | "created_desc") || undefined,
    page: page ? Number(page) : 1,
  });

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (status) baseParams.set("status", status);
  if (service) baseParams.set("service", service);
  if (from) baseParams.set("from", from);
  if (to) baseParams.set("to", to);
  if (sort) baseParams.set("sort", sort);

  function pageHref(targetPage: number): string {
    const params = new URLSearchParams(baseParams);
    params.set("page", String(targetPage));
    return `/admin/booking?${params.toString()}`;
  }

  return (
    <>
      <div className="admin-title-row">
        <h1><Tx>الحجوزات</Tx></h1>
      </div>

      <div className="admin-stats-row">
        <div className="admin-stat-card">
          <div className="admin-stat-value">{stats.total}</div>
          <div className="admin-stat-label"><Tx>الإجمالي</Tx></div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value"><Tx>{stats.confirmed}</Tx></div>
          <div className="admin-stat-label"><Tx>مؤكد</Tx></div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value"><Tx>{stats.pending}</Tx></div>
          <div className="admin-stat-label"><Tx>قيد الانتظار</Tx></div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value"><Tx>{stats.upcoming}</Tx></div>
          <div className="admin-stat-label"><Tx>مواعيد قادمة</Tx></div>
        </div>
      </div>

      <form className="admin-filters">
        <input type="text" name="q" placeholder={t("بحث بالاسم أو البريد أو الهاتف")} defaultValue={q} />
        <select name="status" defaultValue={status ?? ""}>
          <Opt value="">كل الحالات</Opt>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select name="service" defaultValue={service ?? ""}>
          <Opt value="">كل الخدمات</Opt>
          {bookingServiceIds.map((id) => (
            <option key={id} value={id}>
              {bookingServices[id].label}
            </option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={from} aria-label={t("من تاريخ")} />
        <input type="date" name="to" defaultValue={to} aria-label={t("إلى تاريخ")} />
        <select name="sort" defaultValue={sort ?? "created_desc"}>
          <Opt value="created_desc">الأحدث إنشاءً</Opt>
          <Opt value="scheduled_asc">الموعد: الأقرب أولًا</Opt>
          <Opt value="scheduled_desc">الموعد: الأبعد أولًا</Opt>
        </select>
        <button type="submit" className="admin-btn secondary">
          <Tx>فلترة</Tx>
        </button>
      </form>

      {result.bookings.length === 0 ? (
        <div className="admin-empty"><Tx>لا توجد حجوزات بعد.</Tx></div>
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th><Tx>الاسم</Tx></th>
                <th><Tx>البريد</Tx></th>
                <th><Tx>الخدمة</Tx></th>
                <th><Tx>موعد المكالمة</Tx></th>
                <th><Tx>الحالة</Tx></th>
                <th><Tx>تاريخ الإنشاء</Tx></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {result.bookings.map((booking) => (
                <tr key={booking.id}>
                  <td>{booking.name}</td>
                  <td>{booking.email}</td>
                  <td>
                    <span className="admin-badge">
                      <Tx>{bookingServices[booking.service as keyof typeof bookingServices]?.label ?? booking.service}</Tx>
                    </span>
                  </td>
                  <td>
                    {new Date(booking.scheduled_start).toLocaleString("ar-EG", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td>
                    <span className={`admin-badge ${statusBadgeClass[booking.status]}`}><Tx>{statusLabels[booking.status]}</Tx></span>
                  </td>
                  <td>{new Date(booking.created_at).toLocaleDateString("ar-EG")}</td>
                  <td>
                    <Link href={`/admin/booking/${booking.id}`} className="admin-btn secondary">
                      <Tx>عرض</Tx>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 ? (
            <div className="admin-pagination">
              <Link
                href={pageHref(Math.max(1, result.page - 1))}
                className={`admin-btn secondary${result.page <= 1 ? " disabled" : ""}`}
                aria-disabled={result.page <= 1}
              >
                السابق
              </Link>
              <span className="admin-pagination-info">
                <Tx vars={{ page: result.page, totalPages }}>{"صفحة {page} من {totalPages}"}</Tx>
              </span>
              <Link
                href={pageHref(Math.min(totalPages, result.page + 1))}
                className={`admin-btn secondary${result.page >= totalPages ? " disabled" : ""}`}
                aria-disabled={result.page >= totalPages}
              >
                <Tx>التالي</Tx>
              </Link>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
