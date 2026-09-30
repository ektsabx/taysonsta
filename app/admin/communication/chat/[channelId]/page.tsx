import { Tx } from "@/components/bos/I18n";
import { getT } from "@/lib/bos/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { ForbiddenError, NotFoundError } from "@/lib/bos/errors";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getChannel, listChannels, listMessages } from "@/services/bos/chat";
import { listActiveStaff } from "@/services/bos/shared";
import { PageHeader } from "@/components/bos/ui";
import { ChannelList } from "../ChannelList";
import { ChatPane } from "../ChatPane";
import { AddMembersButton, LeaveChannelButton, NewChannelButton, NewDirectButton } from "../ChatControls";

export default async function ChannelPage({ params, searchParams }: { params: Promise<{ channelId: string }>; searchParams: SearchParams }) {
  const t = await getT();
  const { bos } = await requirePermission("chat.read");
  const { channelId } = await params;
  const sp = await readParams(searchParams);
  let channel;
  try {
    channel = await getChannel(bos, channelId);
  } catch (e) {
    if (e instanceof NotFoundError || e instanceof ForbiddenError) notFound();
    throw e;
  }
  const [channels, messages, staff, { data: members }] = await Promise.all([
    listChannels(bos),
    listMessages(bos, channelId, { limit: 100 }),
    listActiveStaff(),
    db().from("channel_members").select("user_id").eq("channel_id", channelId),
  ]);
  const current = channels.find((c) => c.channel.id === channelId);
  const memberIds = new Set((members ?? []).map((m) => m.user_id));
  const people = staff.map((s) => ({ id: s.userId, name: s.name }));
  const others = staff.filter((s) => s.userId !== bos.userId).map((s) => ({ value: s.userId, label: s.name }));
  const linked = channel.project_id ? { href: `/admin/projects/${channel.project_id}`, label: "المشروع" } : channel.deal_id ? { href: `/admin/sales/deals/${channel.deal_id}`, label: "الصفقة" } : channel.client_id && channel.kind === "entity" ? { href: `/admin/clients/${channel.client_id}`, label: "الحساب" } : channel.task_id ? { href: `/admin/projects/tasks/${channel.task_id}`, label: "المهمة" } : null;
  return (
    <>
      <PageHeader
        title={current?.displayName ?? channel.name}
        subtitle={channel.description ?? (channel.kind === "team" && !channel.is_private ? "قناة عامة لكل الفريق" : `${memberIds.size} عضو`)}
       
        actions={
          <>
            {linked ? <Link className="admin-btn small secondary" href={linked.href}><Tx>{linked.label}</Tx></Link> : null}
            {channel.kind === "team" || channel.kind === "entity" ? <AddMembersButton channelId={channelId} people={others.filter((o) => !memberIds.has(o.value))} /> : null}
            {(channel.kind === "team" || channel.kind === "entity") && memberIds.has(bos.userId) ? <LeaveChannelButton channelId={channelId} /> : null}
            {can(bos, "chat.create") ? <NewDirectButton people={others} /> : null}
            {can(bos, "chat.manage") ? <NewChannelButton people={others} /> : null}
          </>
        }
      />
      <div className="bos-chat-layout">
        <aside>
          <form className="bos-chat-search" action="/admin/communication/chat"><input name="q" placeholder={t("بحث في الرسائل...")} aria-label={t("بحث في الرسائل")} /></form>
          <ChannelList channels={channels} active={channelId} />
        </aside>
        <section>
          <ChatPane key={channelId} channelId={channelId} initial={messages} people={people} meId={bos.userId} canPost={can(bos, "chat.create") && !channel.archived_at} threadId={sp.thread ?? null} />
        </section>
      </div>
    </>
  );
}
