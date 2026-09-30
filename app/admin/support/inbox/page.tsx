import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { InboxView } from "./InboxView";

// Unified support inbox (docs/bos/30 §10.2, redesigned in docs/bos/37 §7).
export default async function InboxPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("conversations.read");
  const sp = await readParams(searchParams);
  return <InboxView bos={bos} scope={scope} mode="inbox" sp={sp} />;
}
