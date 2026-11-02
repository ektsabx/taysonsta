import { PIXEL, recordOpen } from "@/lib/outreach/opens";

// The open-tracking image of a campaign email (D-274, lib/outreach/opens.ts).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await recordOpen(id);
  return new Response(PIXEL, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" } });
}
