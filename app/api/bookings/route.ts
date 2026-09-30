import { NextResponse } from "next/server";
import { z } from "zod";
import { createBooking, SlotUnavailableError } from "@/services/booking";
import { bookingServiceIds } from "@/content/booking-services";

const commonFields = {
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(6),
  scheduledStartIso: z.string().min(1),
  scheduledEndIso: z.string().min(1),
  timezone: z.string().min(1),
};

const typedFormServiceIds = ["mvp", "growth"] as const;

const typedBookingSchema = z.object({
  service: z.enum(typedFormServiceIds),
  ...commonFields,
  gccResident: z.enum(["yes", "no"]),
  need: z.enum(["idea_to_startup", "startup_build_product", "product_launch", "existing_product_scale", "expertise_to_product"]),
  projectType: z.enum(["saas", "web_app", "mobile_app", "marketplace", "platform", "not_decided"]),
  ideaClarity: z.enum(["clear_idea", "developing_idea", "problem_only", "unknown"]),
  validationStage: z.enum(["just_idea", "researched_market", "prototype_design", "mvp", "has_customers", "has_revenue"]),
  revenueGoal: z.enum(["growable_startup", "first_customers", "recurring_income", "10k_monthly", "scalable_investable"]),
  startTiming: z.enum(["immediately", "within_30_days", "within_1_3_months", "exploring"]),
  decisionMaker: z.enum(["yes", "partner", "no"]),
  investmentReadiness: z.enum(["ready", "need_details", "no_capital"]),
  source: z.enum(["youtube", "instagram", "tiktok", "ad", "referral"]),
});

const otherServiceIds = bookingServiceIds.filter((id) => !(typedFormServiceIds as readonly string[]).includes(id));

const bookingSchema =
  otherServiceIds.length > 0
    ? z.discriminatedUnion("service", [
        typedBookingSchema,
        z.object({
          service: z.enum(otherServiceIds as [string, ...string[]]),
          ...commonFields,
          answers: z.record(z.string(), z.string()),
        }),
      ])
    : typedBookingSchema;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bookingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }

  try {
    const result = await createBooking(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
