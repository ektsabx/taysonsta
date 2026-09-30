import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/services/booking";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const durationParam = searchParams.get("duration");
    const duration = durationParam ? Number(durationParam) : undefined;
    const durationOverride = duration && Number.isFinite(duration) && duration > 0 ? duration : undefined;

    const slots = await getAvailableSlots(21, durationOverride);
    return NextResponse.json({ slots });
  } catch {
    return NextResponse.json({ error: "Failed to load availability" }, { status: 500 });
  }
}
