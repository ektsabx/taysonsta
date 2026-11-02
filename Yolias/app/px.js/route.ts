import { pixelScript } from "@/lib/pixel";

// The Yolias pixel's browser script (D-274), loaded by the snippet on members' websites.
export function GET() {
  return new Response(pixelScript(), { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" } });
}
