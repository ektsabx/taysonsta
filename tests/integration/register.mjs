import { registerHooks } from "node:module";
import { resolve } from "./loader.mjs";
import { readFileSync } from "node:fs";

// Local-only: load .env.local and refuse to run against a remote database.
for (const line of readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) {
  if (!line.includes("=") || line.trim().startsWith("#")) continue;
  const k = line.slice(0, line.indexOf("=")).trim();
  if (!(k in process.env)) process.env[k] = line.slice(line.indexOf("=") + 1).trim();
}
if (!/127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
  console.error("Integration tests only run against a local Supabase.");
  process.exit(1);
}
registerHooks({ resolve });
