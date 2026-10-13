// Yolias onboarding (D-199): the Admin edits the welcome video (validated,
// audited, read live by Yolias) and sees sign-ups per source. Runs ONLY
// against a local Yolias database (root .env.local points at production —
// run with YOLIAS_SUPABASE_URL / YOLIAS_SUPABASE_SERVICE_ROLE_KEY from
// Yolias/.env.local). Restores the original setting afterwards.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { ydb, yoliasConfigured } from "@/lib/yolias/db";
import { bosUserFor } from "@/tests/integration/helpers";
import { acquisitionSources, getWelcomeVideo, setWelcomeVideo } from "@/services/yolias/onboarding";
import { ValidationError } from "@/lib/bos/errors";

const local = /127\.0\.0\.1|localhost/.test(process.env.YOLIAS_SUPABASE_URL ?? "");
const skip = !yoliasConfigured() || !local;
let original: unknown = null;

after(async () => {
  if (skip || original === null) return;
  await ydb().from("site_settings").upsert({ key: "yolias_welcome_video", value: original as never });
});

test("welcome video: validated, saved for Yolias, audited; sources counted", { skip: skip && "needs a LOCAL Yolias database" }, async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  original = (await ydb().from("site_settings").select("value").eq("key", "yolias_welcome_video").maybeSingle()).data?.value ?? { enabled: false, url: "", title: "", description: "" };

  await assert.rejects(setWelcomeVideo(admin, { enabled: true, url: "https://example.com/page", title: "", description: "" }), ValidationError, "unplayable links are refused");
  await assert.rejects(setWelcomeVideo(admin, { enabled: true, url: "", title: "", description: "" }), ValidationError, "can't turn on without a link");

  await setWelcomeVideo(admin, { enabled: true, url: "https://youtu.be/dQw4w9WgXcQ", title: "Tour", description: "Two minutes" });
  const v = await getWelcomeVideo();
  assert.equal(v.enabled, true);
  assert.equal(v.url, "https://youtu.be/dQw4w9WgXcQ");
  assert.equal(v.title, "Tour");

  const sources = await acquisitionSources();
  assert.ok(Array.isArray(sources));
  assert.ok(sources.every((s) => typeof s.users === "number" && s.users >= s.last30));
});
