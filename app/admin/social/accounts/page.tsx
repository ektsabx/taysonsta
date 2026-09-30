import { redirect } from "next/navigation";

// Connected accounts are managed in Settings → Integrations (docs/bos/37 §5).
export default function MovedAccounts() {
  redirect("/admin/settings/integrations/social");
}
