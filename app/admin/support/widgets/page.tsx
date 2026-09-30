import { redirect } from "next/navigation";

// The website widget moved to Settings → Integrations (docs/bos/37 §5).
// Old links and bookmarks keep working; embed codes use /api/public/widget.
export default function SupportWidgetsMoved() {
  redirect("/admin/settings/integrations/widgets");
}
