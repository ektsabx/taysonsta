import { NextResponse } from "next/server";
import { z } from "zod";
import {
  InvalidJobError,
  InvalidPortfolioFileError,
  submitCareerApplication,
  uploadCareerApplicationPortfolio,
} from "@/services/careers";

const applicationSchema = z.object({
  jobId: z.string().uuid(),
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100),
  phone: z.string().min(6).max(30),
  email: z.string().email().max(200),
  instagramHandle: z.string().min(1).max(100),
  otherSocials: z.string().max(500).optional(),
  country: z.string().min(2).max(100),
  age: z.coerce.number().int().min(14).max(100),
  educationStatus: z.string().min(1).max(300),
  coursesCompleted: z.string().max(1000).optional(),
  yearsExperience: z.coerce.number().min(0).max(60),
  bio: z.string().min(10).max(3000),
  whyFit: z.string().min(10).max(3000),
  expectedSalary: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = applicationSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid submission" }, { status: 422 });
  }

  const file = formData.get("portfolioFile");
  let portfolioPath: string | undefined;

  try {
    if (file instanceof File && file.size > 0) {
      portfolioPath = await uploadCareerApplicationPortfolio(parsed.data.jobId, file);
    }

    const applicationId = await submitCareerApplication({ ...parsed.data, portfolioPath });

    const response = NextResponse.json({ success: true, applicationId });
    response.cookies.set(`career_applied_${parsed.data.jobId}`, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    if (error instanceof InvalidJobError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof InvalidPortfolioFileError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
  }
}
