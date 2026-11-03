import { requirePermission, can } from "@/lib/bos/auth";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { Panel } from "@/components/yolias/dash/Stat";
import { getWelcomeVideo } from "@/services/yolias/onboarding";
import { getPopups } from "@/services/yolias/popups";
import { WelcomeVideoForm } from "../onboarding/WelcomeVideoForm";
import { ReviewForm } from "./ReviewForm";

// Every popup Yolias shows its members, in one place (owner, 2026-11-03,
// D-276): the welcome video after sign-in and the review request.
export default async function PopupsPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return <NotConnected />;
  const [video, popups] = await Promise.all([getWelcomeVideo(), getPopups()]);
  const manage = can(bos, "platform.manage", "all");
  return (
    <div className="yd">
      <div className="yd-head"><h1><Tx>النوافذ المنبثقة</Tx></h1></div>
      <div className="yd-grid2">
        <Panel title="فيديو الترحيب «Hey There, I'm Yolias»">{manage ? <WelcomeVideoForm value={video} /> : null}</Panel>
        <Panel title="طلب التقييم">{manage ? <ReviewForm value={popups.review} /> : null}</Panel>
      </div>
    </div>
  );
}
