import { Tx } from "@/components/bos/I18n";
import { getT } from "@/lib/bos/i18n/server";
import Link from "next/link";
import type { listChannels } from "@/services/bos/chat";
import { channelKindLabels } from "@/services/bos/chat";

type Item = Awaited<ReturnType<typeof listChannels>>[number];

export async function ChannelList({ channels, active }: { channels: Item[]; active?: string }) {
  const t = await getT();
  const groups = ["direct", "team", "project", "entity"] as const;
  return (
    <nav className="bos-channel-list" aria-label={t("القنوات")}>
      {groups.map((g) => {
        const items = channels.filter((c) => c.channel.kind === g);
        if (!items.length) return null;
        return (
          <div key={g}>
            <div className="bos-channel-group"><Tx>{channelKindLabels[g]}</Tx></div>
            {items.map((c) => (
              <Link key={c.channel.id} href={`/admin/communication/chat/${c.channel.id}`} className={`bos-channel${c.channel.id === active ? " active" : ""}${c.unread ? " unread" : ""}`}>
                <span className="name">{g === "team" && !c.channel.is_private ? "# " : ""}{c.displayName}</span>
                {c.unread ? <span className="count"><Tx>{c.unread}</Tx></span> : null}
                {c.lastMessage ? <span className="preview">{c.lastMessage.is_system ? "⚙ " : ""}{c.lastMessage.body.slice(0, 60)}</span> : null}
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );
}
