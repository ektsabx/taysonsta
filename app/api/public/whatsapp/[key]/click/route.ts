import { NextResponse, type NextRequest } from "next/server";
import { recordWaClick, waWidgetByKey } from "@/services/bos/whatsapp-widgets";
import { hostAllowed } from "@/lib/bos/ai-agent-prompt";
import { clientIp } from "@/lib/bos/widget-http";
import { rateOk } from "@/services/bos/widgets";

// Click counter for the WhatsApp button — counted only from allowed domains,
// rate limited per IP; nothing about the visitor is stored.
export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const w = await waWidgetByKey(key);
  const origin = req.headers.get("origin");
  if (!w || !hostAllowed(origin, w.allowed_domains)) return new NextResponse(null, { status: 204 });
  if (await rateOk(`wa:${w.id}:${clientIp(req)}`, 3600, 20)) await recordWaClick(w.id);
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": origin! } });
}
