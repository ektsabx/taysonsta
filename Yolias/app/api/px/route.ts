import { recordPixelEvent } from "@/lib/pixel";

// Events from the Yolias pixel on members' websites (D-274). Sent as text/plain
// (sendBeacon / no-cors), so no preflight; the answer is always empty.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const text = (await req.text().catch(() => "")).slice(0, 8000);
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (body && typeof body === "object") await recordPixelEvent(body as Record<string, unknown>);
  return new Response(null, { status: 204, headers: CORS });
}
