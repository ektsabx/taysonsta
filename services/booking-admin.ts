import { nowIso } from "@/lib/bos/clock";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BookingStatus, Database } from "@/types/database";

// Narrowed from the generated row types: `status` is CHECK-constrained and
// `answers` holds the generic { questionKey: answerValue } map.
export type Booking = Omit<Database["public"]["Tables"]["bookings"]["Row"], "status"> & { status: BookingStatus };
export type BookingAnswers = Omit<Database["public"]["Tables"]["booking_answers"]["Row"], "answers"> & {
  answers: Record<string, string> | null;
};

export const bookingStatuses: BookingStatus[] = ["pending", "confirmed", "unqualified", "cancelled"];

export interface ListBookingsFilters {
  search?: string;
  status?: BookingStatus;
  service?: string;
  from?: string;
  to?: string;
  sort?: "scheduled_asc" | "scheduled_desc" | "created_desc";
  page?: number;
}

export interface ListBookingsResult {
  bookings: Booking[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

export async function listBookingsAdmin(filters: ListBookingsFilters = {}): Promise<ListBookingsResult> {
  const supabase = createAdminClient();
  const page = filters.page && filters.page > 0 ? filters.page : 1;

  let query = supabase.from("bookings").select("*", { count: "exact" });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.service) {
    query = query.eq("service", filters.service);
  }
  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(`name.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
  }
  if (filters.from) {
    query = query.gte("scheduled_start", filters.from);
  }
  if (filters.to) {
    query = query.lte("scheduled_start", `${filters.to}T23:59:59`);
  }

  if (filters.sort === "scheduled_asc") {
    query = query.order("scheduled_start", { ascending: true });
  } else if (filters.sort === "scheduled_desc") {
    query = query.order("scheduled_start", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return { bookings: (data ?? []) as Booking[], total: count ?? 0, page, pageSize: PAGE_SIZE };
}

export interface BookingWithAnswers extends Booking {
  answers: BookingAnswers | null;
}

export async function getBookingByIdAdmin(id: string): Promise<BookingWithAnswers | null> {
  const supabase = createAdminClient();

  const { data: booking, error } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw error;
  }

  if (!booking) {
    return null;
  }

  const { data: answers, error: answersError } = await supabase
    .from("booking_answers")
    .select("*")
    .eq("booking_id", id)
    .maybeSingle();

  if (answersError) {
    throw answersError;
  }

  return { ...(booking as Booking), answers: (answers as BookingAnswers | null) ?? null };
}

export async function updateBookingStatusAdmin(id: string, status: BookingStatus): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("bookings").update({ status }).eq("id", id);

  if (error) {
    throw error;
  }
}

export interface BookingsStats {
  total: number;
  confirmed: number;
  pending: number;
  upcoming: number;
}

export async function getBookingsStatsAdmin(): Promise<BookingsStats> {
  const supabase = createAdminClient();
  const now = nowIso();

  const [{ count: total }, { count: confirmed }, { count: pending }, { count: upcoming }] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed")
      .gte("scheduled_start", now),
  ]);

  return { total: total ?? 0, confirmed: confirmed ?? 0, pending: pending ?? 0, upcoming: upcoming ?? 0 };
}
