import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { PageHeader, Card } from "@/components/bos/ui";
import { AiPanel } from "../ContentControls";

// Idea generator (docs/bos/30 §13.2): AI drafts not tied to an item yet.
export default async function ContentIdeasPage() {
  const { bos } = await requirePermission("content.create");
  const [{ data: drafts }, { count: ai }] = await Promise.all([
    db().from("content_ai_drafts").select("*").is("item_id", null).neq("kind", "insights").eq("created_by", bos.userId).neq("status", "discarded").order("created_at", { ascending: false }).limit(20),
    db().from("integration_connections").select("id", { count: "exact", head: true }).in("provider", ["anthropic", "openai", "gemini"]).eq("status", "active"),
  ]);
  return (
    <>
      <PageHeader title="مولّد الأفكار" subtitle="أفكار ومسودات بالذكاء الاصطناعي — انسخ ما يعجبك إلى فكرة جديدة" />
      <Card><AiPanel itemId={null} drafts={drafts ?? []} aiReady={!!ai} /></Card>
      <p className="bos-hint"><Tx>المسودات هنا خاصة بك.</Tx></p>
    </>
  );
}
