import { requirePermission } from "@/lib/bos/auth";
import { Card, PageHeader } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { APPS, ownPixel, savedListings } from "@/services/yolias/app-listings";
import { ListingForm, OwnPixelForm } from "./ListingForm";

// Screenshots, new versions and the Chrome Web Store link for the tools on
// Yolias's Integrations pages (owner, 2026-11-05).
export default async function AppListingsPage() {
  await requirePermission("integrations.manage");
  if (!connected()) return (<><PageHeader title="إضافات وتكاملات يولياس" /><NotConnected /></>);
  const [saved, pixel] = await Promise.all([savedListings(), ownPixel()]);
  return (
    <>
      <PageHeader title="إضافات وتكاملات يولياس" subtitle="الصور والإصدارات والروابط التي تظهر للعملاء في صفحة التكاملات." />
      <Card title={<Tx>بيكسل موقع يولياس</Tx>}><OwnPixelForm value={pixel} /></Card>
      {APPS.map((a) => {
        const s = saved[a.key] ?? {};
        return <Card key={a.key} title={<Tx>{a.name}</Tx>}><ListingForm k={a.key} addon={a.addon} shots={s.screenshots ?? []} version={s.version ?? ""} storeUrl={s.store_url ?? ""} downloadUrl={s.download_url ?? ""} /></Card>;
      })}
    </>
  );
}
