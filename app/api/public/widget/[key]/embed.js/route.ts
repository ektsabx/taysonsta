import type { NextRequest } from "next/server";
import { WIDGET_JS } from "./widget-client";

// Embeddable support widget (docs/bos/30 §10.5):
//   <script src="https://<bos-host>/api/public/widget/<KEY>/embed.js" async></script>
// The API base is taken from the script's own address, so a site can serve
// the widget from its own domain through a proxy (Yolias does, D-134).
// Vanilla JS inside a Shadow DOM (no styles leak either way). All text is
// inserted with textContent — never as HTML. The API only answers pages on
// the widget's allowed domains, so a copied key is useless elsewhere.

const script = (api: string) => WIDGET_JS.replace("__FALLBACK_API__", JSON.stringify(api));

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^[0-9a-f]{16,64}$/.test(key)) return new Response("// invalid key", { status: 404, headers: { "content-type": "application/javascript" } });
  const api = `${req.nextUrl.origin}/api/public/widget/${key}`;
  return new Response(script(api), { headers: { "content-type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } });
}
