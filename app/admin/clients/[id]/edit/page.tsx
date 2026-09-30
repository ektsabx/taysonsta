import { Tx } from "@/components/bos/I18n";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { NotFoundError } from "@/lib/bos/errors";
import { getAccount } from "@/services/bos/accounts";
import { listActiveStaff, listCurrencies } from "@/services/bos/shared";
import { PageHeader } from "@/components/bos/ui";
import { AccountForm } from "../../AccountForm";
import { updateAccountAction } from "../../actions";

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("clients.update");
  const { id } = await params;
  if (!(await canAccessEntity(bos, "client", id, "update"))) notFound();
  let account;
  try {
    account = await getAccount(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const [staff, currencies] = await Promise.all([listActiveStaff(), listCurrencies()]);
  return (
    <>
      <PageHeader title={<Tx vars={{ company_name: account.company_name ?? account.name }}>{"تعديل: {company_name}"}</Tx>} breadcrumbs={[{ label: "الحسابات", href: "/admin/clients" }, { label: account.company_name ?? account.name, href: `/admin/clients/${id}` }, { label: "تعديل" }]} />
      <AccountForm action={updateAccountAction.bind(null, id)} initial={account} staff={staff.map((s) => ({ value: s.userId, label: s.name }))} currencies={currencies} canAssign={can(bos, "clients.assign")} />
    </>
  );
}
