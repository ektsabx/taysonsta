import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card, UserAvatar } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { agentProfile } from "@/services/bos/support-ratings";
import { ProfileForm } from "./ProfileForm";

// How a staff member appears to customers in the website messenger (D-180):
// their chosen name, and their photo only if they allow it.
export default async function SupportProfilePage() {
  const { bos } = await requirePermission("conversations.read");
  const p = await agentProfile(bos.userId);
  const full = bos.employee?.full_name ?? bos.email;
  const parts = full.trim().split(/\s+/);
  const short = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1].charAt(0)}.` : parts[0];
  return (
    <>
      <PageHeader title="ملفي في الدعم" subtitle={<Tx>كيف تظهر للعملاء عندما ترد على محادثاتهم.</Tx>} />
      <Card>
        <div className="bos-row" style={{ gap: 12, marginBottom: 16 }}>
          <UserAvatar name={p?.display_name || short} userId={p?.show_photo ? bos.userId : null} size="lg" />
          <div>
            <strong>{p?.display_name || short}</strong>
            <div className="bos-faint" style={{ fontSize: 12 }}><Tx>{p?.show_photo ? "تظهر صورتك للعملاء" : "لا تظهر صورتك للعملاء"}</Tx></div>
          </div>
        </div>
        <ProfileForm displayName={p?.display_name ?? ""} showPhoto={p?.show_photo ?? false} defaultName={short} />
      </Card>
    </>
  );
}
