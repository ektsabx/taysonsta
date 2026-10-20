import { requirePermission } from "@/lib/bos/auth";
import { messagingReady } from "@/services/yolias/messaging";
import { PageHeader } from "@/components/bos/ui";
import { MessagingNotReady, NotConnected, connected } from "@/components/yolias/PlatformUi";
import { yoliasSiteUrl } from "@/lib/yolias/db";
import { ContentEditor } from "../../_ui/ContentEditor";
import { saveTemplateAction } from "../../actions";

export default async function NewTemplatePage() {
  await requirePermission("platform.manage", "all");
  if (!connected()) return (<><PageHeader title="قالب جديد" /><NotConnected /></>);
  if (!(await messagingReady())) return (<><PageHeader title="قالب جديد" /><MessagingNotReady /></>);
  return (
    <>
      <PageHeader title="قالب جديد" />
      <ContentEditor action={saveTemplateAction} siteUrl={yoliasSiteUrl().replace(/\/$/, "")} submitLabel="إنشاء القالب"
        value={{ name: "", description: null, category: "lifecycle", subject: "", preview_text: null, html: "<p>Hi {{first_name}},</p>\n<p></p>\n<p><a href=\"{{app_url}}\">Open Yolias</a></p>", text_body: null }} />
    </>
  );
}
