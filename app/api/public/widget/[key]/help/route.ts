import type { NextRequest } from "next/server";
import { guard, json, preflight } from "@/lib/bos/widget-http";
import { helpSearch } from "@/services/bos/widgets";

// The Help tab on sites without their own help center: published public
// knowledge-base articles. (Yolias answers this path itself, from its own
// Help Center, in its widget proxy.)
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const g = await guard(req, key, { rate: [60, 120] });
  if ("response" in g) return g.response;
  return json(await helpSearch(g.widget, req.nextUrl.searchParams.get("q") ?? ""), 200, g.origin);
}

export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  return preflight(req, (await params).key);
}
