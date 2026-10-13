import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseWelcomeVideo, WELCOME_VIDEO_KEY, type WelcomeVideo } from "./welcome-video";

export async function loadWelcomeVideo(): Promise<WelcomeVideo | null> {
  try {
    const { data } = await createAdminClient().from("site_settings").select("value").eq("key", WELCOME_VIDEO_KEY).maybeSingle();
    return parseWelcomeVideo(data?.value);
  } catch {
    // The video never blocks the app.
    return null;
  }
}
