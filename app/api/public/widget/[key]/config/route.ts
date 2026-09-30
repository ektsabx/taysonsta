import type { NextRequest } from "next/server";
import { guard, json, preflight } from "@/lib/bos/widget-http";
import { publicConfig } from "@/services/bos/widgets";

// Public widget configuration (docs/bos/30 §10.5).
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const g = await guard(req, key, { rate: [60, 120] });
  if ("response" in g) return g.response;
  return json(publicConfig(g.widget), 200, g.origin);
}

export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  return preflight(req, (await params).key);
}
