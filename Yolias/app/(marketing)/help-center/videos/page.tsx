import { permanentRedirect } from "next/navigation";

// The videos page was removed (owner, 2026-11-10): each video plays inside its
// Help Center article. Old links land on the Help Center.
export default function VideosPage() {
  permanentRedirect("/help-center");
}
