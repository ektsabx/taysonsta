import { knowledgeFeed } from "@/lib/knowledge";

// Public content as JSON for the Yolias Admin support agent (lib/knowledge.ts).
// Everything here is already public on the website.
export async function GET() {
  const items = await knowledgeFeed();
  return Response.json({ version: 1, generatedAt: new Date().toISOString(), items }, { headers: { "cache-control": "public, max-age=600" } });
}
