import { nowMs } from "@/lib/bos/clock";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAvailableSlots, type TimeSlot } from "@/lib/availability";
import { isQualified, type StartTiming } from "@/lib/qualification";
import type { Database, DecisionMaker, GccResident, InvestmentReadiness } from "@/types/database";

type BookingAnswersInsert = Database["public"]["Tables"]["booking_answers"]["Insert"];

export async function getAvailableSlots(daysAhead = 21, durationMinutesOverride?: number): Promise<Record<string, TimeSlot[]>> {
  const supabase = await createClient();

  const { data: rules, error: rulesError } = await supabase
    .from("availability_rules")
    .select("weekday, start_time, end_time, slot_minutes, timezone")
    .eq("is_active", true);

  if (rulesError) {
    throw rulesError;
  }

  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("scheduled_start")
    .eq("status", "confirmed");

  if (bookingsError) {
    throw bookingsError;
  }

  return generateAvailableSlots(
    rules ?? [],
    (bookings ?? []).map((b) => new Date(b.scheduled_start).toISOString()),
    daysAhead,
    new Date(nowMs()),
    durationMinutesOverride
  );
}

interface CommonBookingFields {
  name: string;
  email: string;
  phone: string;
  scheduledStartIso: string;
  scheduledEndIso: string;
  timezone: string;
}

export interface CreateSaasBookingInput extends CommonBookingFields {
  service: "mvp" | "growth";
  gccResident: GccResident;
  need: string;
  projectType: string;
  ideaClarity: string;
  validationStage: string;
  revenueGoal: string;
  startTiming: StartTiming;
  decisionMaker: DecisionMaker;
  investmentReadiness: InvestmentReadiness;
  source: string;
}

export interface CreateGenericBookingInput extends CommonBookingFields {
  service: string;
  answers: Record<string, string>;
}

export type CreateBookingInput = CreateSaasBookingInput | CreateGenericBookingInput;

export interface CreateBookingResult {
  qualified: boolean;
  bookingId: string;
}

export class SlotUnavailableError extends Error {
  constructor() {
    super("Selected time slot is no longer available");
    this.name = "SlotUnavailableError";
  }
}

function isSaasInput(input: CreateBookingInput): input is CreateSaasBookingInput {
  return input.service === "mvp" || input.service === "growth";
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const supabase = createAdminClient();

  const qualified = isSaasInput(input)
    ? isQualified({
        gccResident: input.gccResident,
        decisionMaker: input.decisionMaker,
        investmentReadiness: input.investmentReadiness,
        startTiming: input.startTiming,
      })
    : true;

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      service: input.service,
      name: input.name,
      email: input.email,
      phone: input.phone,
      scheduled_start: input.scheduledStartIso,
      scheduled_end: input.scheduledEndIso,
      timezone: input.timezone,
      status: qualified ? "confirmed" : "unqualified",
    })
    .select("id")
    .single();

  if (bookingError) {
    if (bookingError.code === "23505") {
      throw new SlotUnavailableError();
    }
    throw bookingError;
  }

  if (!booking) {
    throw new Error("Booking insert failed");
  }

  const answersPayload: BookingAnswersInsert = isSaasInput(input)
    ? {
        booking_id: booking.id,
        gcc_resident: input.gccResident,
        need: input.need,
        project_type: input.projectType,
        idea_clarity: input.ideaClarity,
        validation_stage: input.validationStage,
        revenue_goal: input.revenueGoal,
        start_timing: input.startTiming,
        decision_maker: input.decisionMaker,
        investment_readiness: input.investmentReadiness,
        source: input.source,
        answers: null,
      }
    : {
        booking_id: booking.id,
        gcc_resident: null,
        need: null,
        project_type: null,
        idea_clarity: null,
        validation_stage: null,
        revenue_goal: null,
        start_timing: null,
        decision_maker: null,
        investment_readiness: null,
        source: null,
        answers: input.answers,
      };

  const { error: answersError } = await supabase.from("booking_answers").insert(answersPayload);

  if (answersError) {
    throw answersError;
  }

  return { qualified, bookingId: booking.id as string };
}
