import { Tx } from "@/components/bos/I18n";
import { getT } from "@/lib/bos/i18n/server";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { listChannels, searchMessages } from "@/services/bos/chat";
import { listActiveStaff } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { formatDateTime } from "@/lib/bos/format";
import { ChannelList } from "./ChannelList";
import { NewChannelButton, NewDirectButton } from "./ChatControls";

// Internal chat (§40): channel list, search across accessible channels.
export default async function ChatPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getT();
  const { bos } = await requirePermission("chat.read");
  const sp = await readParams(searchParams);
  const [channels, staff, results] = await Promise.all([listChannels(bos), listActiveStaff(), sp.q ? searchMessages(bos, sp.q) : Promise.resolve(null)]);
  const people = staff.filter((s) => s.userId !== bos.userId).map((s) => ({ value: s.userId, label: s.name }));
  return (
    <>
      <PageHeader
        title="المحادثات"
        breadcrumbs={[{ label: "التواصل" }, { label: "المحادثات" }]}
        actions={<>{can(bos, "chat.create") ? <NewDirectButton people={people} /> : null}{can(bos, "chat.manage") ? <NewChannelButton people={people} /> : null}</>}
      />
      <div className="bos-chat-layout">
        <aside>
          <form className="bos-chat-search"><input name="q" defaultValue={sp.q ?? ""} placeholder={t("بحث في الرسائل...")} aria-label={t("بحث في الرسائل")} /></form>
          <ChannelList channels={channels} />
        </aside>
        <section>
          {results ? (
            <Card title={<Tx vars={{ q: sp.q, results_count: results.length }}>{"نتائج البحث عن «{q}» ({results_count})"}</Tx>}>
              {results.length ? results.map((r) => (
                <Link key={r.id} href={`/admin/communication/chat/${r.channel_id}${r.parent_id ? `?thread=${r.parent_id}` : ""}`} className="bos-search-hit">
                  <div className="bos-faint" style={{ fontSize: 12 }}>{r.channelName} · {formatDateTime(r.created_at)}</div>
                  <div>{r.body.slice(0, 240)}</div>
                </Link>
              )) : <EmptyState title="لا توجد نتائج في القنوات المتاحة لك" />}
            </Card>
          ) : (
            <EmptyState title="اختر محادثة" description="قنوات المشاريع تُنشأ تلقائياً لفريق كل مشروع. يمكنك بدء رسالة مباشرة أو مناقشة أي سجل من صفحته." />
          )}
        </section>
      </div>
    </>
  );
}
