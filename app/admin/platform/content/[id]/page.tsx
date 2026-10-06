import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { blocksToMarkdown, contentKinds, kindLabel, type ContentKind, type Doc } from "@/lib/yolias/content";
import { getContent } from "@/services/yolias/content";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { ContentForm, type ContentFormValues } from "../ContentForm";

const empty = { title: "", summary: "", body: "" };
const side = (d: Doc | undefined) => (d ? { title: d.title, summary: d.summary, body: blocksToMarkdown(d.blocks) } : empty);

// Edit one website page (or create one: /new?kind=help).
export default async function ContentEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="محتوى الموقع" /><NotConnected /></>);
  const { id } = await params;
  const sp = await searchParams;
  let v: ContentFormValues;
  if (id === "new") {
    const kind = (contentKinds as readonly string[]).includes(sp.kind ?? "") && sp.kind !== "legal" ? (sp.kind as ContentKind) : "help";
    v = { id: null, kind, slug: "", status: "draft", sort: 0, collection: "getting-started", group: "start", date: new Date().toISOString().slice(0, 10), categoryEn: "", categoryAr: "", en: empty, ar: empty };
  } else {
    if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
    const c = await getContent(id).catch(() => null);
    if (!c) notFound();
    const cat = (c.meta.category ?? {}) as { en?: string; ar?: string };
    v = {
      id: c.id, kind: c.kind as ContentKind, slug: c.slug, status: c.status, sort: c.sort,
      collection: String(c.meta.collection ?? ""), group: String(c.meta.group ?? ""), date: String(c.meta.date ?? ""), categoryEn: cat.en ?? "", categoryAr: cat.ar ?? "",
      en: side(c.doc.en), ar: side(c.doc.ar),
    };
  }
  const manage = can(bos, "platform.manage", "all");
  return (
    <>
      <PageHeader title={id === "new" ? "صفحة جديدة" : v.ar.title || v.slug} subtitle={kindLabel[v.kind]} actions={<Link className="admin-btn secondary" href={`/admin/platform/content?kind=${v.kind}`}><Tx>كل الصفحات</Tx></Link>} />
      <Card>{manage ? <ContentForm v={v} /> : <pre dir="auto" style={{ whiteSpace: "pre-wrap" }}>{v.ar.body}</pre>}</Card>
    </>
  );
}
