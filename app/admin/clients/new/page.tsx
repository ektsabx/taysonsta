import { requirePermission, can } from "@/lib/bos/auth";
import { listActiveStaff, listCurrencies } from "@/services/bos/shared";
import { PageHeader } from "@/components/bos/ui";
import { AccountForm } from "../AccountForm";
import { createAccountAction } from "../actions";

export default async function NewAccountPage() {
  const { bos } = await requirePermission("clients.create");
  const [staff, currencies] = await Promise.all([listActiveStaff(), listCurrencies()]);
  return (
    <>
      <PageHeader title="حساب جديد" />
      <AccountForm
        action={createAccountAction}
        staff={staff.map((s) => ({ value: s.userId, label: s.name }))}
        currencies={currencies}
        canAssign={can(bos, "clients.assign")}
        initial={{ account_manager_id: bos.roleKeys.includes("account_manager") ? bos.userId : "" }}
        isNew
        submitLabel="إنشاء الحساب"
      />
    </>
  );
}
