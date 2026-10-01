import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../Yolias/types/database";

export type { Database as YoliasDatabase } from "../../Yolias/types/database";
export type YTables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

// Server-only connection from Yolias Admin to the Yolias database
// (docs/12-decisions.md D-010). The two products keep separate Supabase
// projects; the admin reaches Yolias with its own service key and only
// after a `platform.*` permission check. Never import this from a client
// component. Locally `npm run local` (scripts/dev-all.sh) fills:
//   YOLIAS_SUPABASE_URL, YOLIAS_SUPABASE_SERVICE_ROLE_KEY, YOLIAS_SITE_URL

export function yoliasConfigured(): boolean {
  return Boolean(process.env.YOLIAS_SUPABASE_URL && process.env.YOLIAS_SUPABASE_SERVICE_ROLE_KEY);
}

let client: SupabaseClient<Database> | null = null;

export function ydb(): SupabaseClient<Database> {
  if (!yoliasConfigured()) throw new Error("Yolias database is not configured (YOLIAS_SUPABASE_URL / YOLIAS_SUPABASE_SERVICE_ROLE_KEY).");
  client ??= createClient<Database>(process.env.YOLIAS_SUPABASE_URL!, process.env.YOLIAS_SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Public URL of the Yolias customer app (links from the admin). */
export function yoliasSiteUrl(): string {
  return (process.env.YOLIAS_SITE_URL ?? "http://localhost:3200").replace(/\/$/, "");
}

/** The Yolias `intel` schema (providers, costs, shared data). Service role only. */
export function yintel() {
  return ydb().schema("intel");
}
