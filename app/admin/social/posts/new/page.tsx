import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { listAccounts } from "@/services/bos/social";
import { PageHeader, Card } from "@/components/bos/ui";
import { PostEditor, type AccountOpt } from "../../PostEditor";

export default async function NewSocialPostPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("social.create");
  const sp = await readParams(searchParams);
  const accounts = (await listAccounts({ activeOnly: true })) as AccountOpt[];
  return (
    <>
      <PageHeader title="منشور جديد" />
      <Card><PostEditor accounts={accounts} initial={{ scheduled_at: sp.date ? `${sp.date}T09:00:00` : null }} /></Card>
    </>
  );
}
