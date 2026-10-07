// `next build` for the Cloudflare build (open-next.config.ts buildCommand;
// OpenNext runs it in standalone mode, then bundles), with one fix after it:
// Sentry brings @opentelemetry/api into node_modules, and Next's tracer then
// resolves it in the proxy (middleware). Next's file trace copies only the
// package's CommonJS build, but OpenNext bundles the middleware with the
// "module" condition (its ESM build) and fails. Adding the ESM files to the
// middleware trace fixes it (see @opennextjs/cloudflare patches/plugins/require.js).
import { execSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

run("npx next build");

const trace = ".next/server/middleware.js.nft.json";
const esm = "node_modules/@opentelemetry/api/build/esm";
if (existsSync(trace) && existsSync(esm)) {
  const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
  const nft = JSON.parse(readFileSync(trace, "utf8"));
  const files = new Set(nft.files);
  for (const f of walk(esm)) files.add(relative(".next/server", f));
  nft.files = [...files];
  writeFileSync(trace, JSON.stringify(nft));
  // OpenNext copies traced files from the standalone output.
  if (existsSync(".next/standalone/node_modules")) cpSync(esm, join(".next/standalone", esm), { recursive: true });
}
