import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { InboxView } from "../inbox/InboxView";

// Spam folder (docs/bos/37 §3): conversations flagged as spam, searchable,
// restorable (permission checked in the service).
export default async function SpamPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("conversations.read");
  const sp = await readParams(searchParams);
  return <InboxView bos={bos} scope={scope} mode="spam" sp={sp} />;
}
