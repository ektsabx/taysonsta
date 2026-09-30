import { NextResponse } from "next/server";
import { z } from "zod";
import { subscribeToNewsletter, DuplicateSubscriberError } from "@/services/newsletter";

const newsletterSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = newsletterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  try {
    await subscribeToNewsletter(parsed.data.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DuplicateSubscriberError) {
      return NextResponse.json({ ok: true, alreadySubscribed: true });
    }
    return NextResponse.json({ error: "subscribe_failed" }, { status: 500 });
  }
}
