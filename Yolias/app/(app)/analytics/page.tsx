import { redirect } from "next/navigation";

// The analytics overview became part of the dashboard (owner, 2026-10-31, D-270).
export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const range = (await searchParams).range;
  redirect(typeof range === "string" ? `/dashboard?range=${encodeURIComponent(range)}` : "/dashboard");
}
