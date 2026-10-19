import { knowledgeFeed } from "@/lib/knowledge";
import { DEFINITION } from "@/lib/seo";

// The full public text of the site for AI assistants (llms-full.txt), English
// pages only to keep it focused; /llms.txt is the short index.
export async function GET() {
  const items = (await knowledgeFeed()).filter((i) => i.language === "en");
  const body = `# Yolias\n\n> ${DEFINITION}\n\n${items.map((i) => `# ${i.title}\nSource: ${i.url}\n\n${i.content}`).join("\n\n---\n\n")}\n`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
