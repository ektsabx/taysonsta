import { getT } from "@/lib/bos/i18n/server";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requireBosUser } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { globalSearch, searchTypes } from "@/services/bos/search";
import { entityTypeLabels } from "@/lib/bos/links";
import type { PermissionKey } from "@/lib/bos/permissions";
import { searchMessages } from "@/services/bos/chat";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { formatDateTime } from "@/lib/bos/format";

// Global search (§66): every module the user can read, permission-filtered
// per record, plus chat messages in accessible channels.
export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getT();
  const bos = await requireBosUser();
  const sp = await readParams(searchParams);
  const q = (sp.q ?? "").trim();
  const type = sp.type;
  const [hits, messages] = q.length >= 2
    ? await Promise.all([globalSearch(bos, q, type ? 50 : 12, type), !type && bos.permissions.get("chat.read") ? searchMessages(bos, q) : Promise.resolve([])])
    : [[], []];
  const groups = [...new Set(hits.map((h) => h.type))];
  return (
    <>
      <PageHeader title="البحث" />
      <form className="bos-row" style={{ gap: 8, marginBottom: 14 }}>
        <input name="q" defaultValue={q} placeholder={t("ابحث في الموظفين، العملاء، الصفقات، المشاريع، المهام، الفواتير، المصروفات، الاجتماعات، المستندات، التذاكر، المحادثات، الملفات، المعرفة...")} style={{ flex: 1 }} autoFocus aria-label={t("البحث")} />
        {type ? <input type="hidden" name="type" value={type} /> : null}
        <button className="admin-btn" type="submit"><Tx>بحث</Tx></button>
      </form>
      {q.length >= 2 ? (
        <div className="bos-row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <Link className={`admin-btn small ${!type ? "" : "ghost"}`} href={`/admin/search?q=${encodeURIComponent(q)}`}><Tx>الكل</Tx></Link>
          {searchTypes.filter((st) => bos.permissions.has(`${({ lead: "leads", contact: "contacts", client: "clients", deal: "deals", project: "projects", task: "tasks", file: "files", ticket: "tickets", kb_article: "knowledge", employee: "employees", invoice: "invoices", expense: "expenses", meeting: "meetings", document: "documents", conversation: "conversations" } as Record<string, string>)[st]}.read` as PermissionKey)).map((st) => <Link key={st} className={`admin-btn small ${type === st ? "" : "ghost"}`} href={`/admin/search?q=${encodeURIComponent(q)}&type=${st}`}><Tx>{entityTypeLabels[st] ?? st}</Tx></Link>)}
        </div>
      ) : null}
      {q.length < 2 ? <EmptyState title="اكتب حرفين على الأقل" /> : !hits.length && !messages.length ? <EmptyState title={`لا توجد نتائج متاحة لك لـ «${q}»`} /> : (
        <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {groups.map((g) => {
            const items = hits.filter((h) => h.type === g);
            return (
              <Card key={g} title={`${items[0].typeLabel} (${items.length})`} actions={!type ? <Link className="bos-link" href={`/admin/search?q=${encodeURIComponent(q)}&type=${g}`}><Tx>المزيد</Tx></Link> : <Link className="bos-link" href={`/admin/search?q=${encodeURIComponent(q)}`}><Tx>كل الأنواع</Tx></Link>}>
                {items.map((h) => <Link key={h.id} href={h.href} className="bos-search-hit"><div><Tx>{h.title}</Tx></div>{h.subtitle ? <div className="bos-faint" style={{ fontSize: 12 }}><Tx>{h.subtitle}</Tx></div> : null}</Link>)}
              </Card>
            );
          })}
          {messages.length ? (
            <Card title={<Tx vars={{ messages_count: messages.length }}>{"رسائل المحادثات ({messages_count})"}</Tx>}>
              {messages.slice(0, 12).map((m) => <Link key={m.id} href={`/admin/communication/chat/${m.channel_id}${m.parent_id ? `?thread=${m.parent_id}` : ""}`} className="bos-search-hit"><div className="bos-faint" style={{ fontSize: 12 }}>{m.channelName} · {formatDateTime(m.created_at)}</div><div>{m.body.slice(0, 160)}</div></Link>)}
            </Card>
          ) : null}
        </div>
      )}
    </>
  );
}
