// Test-only module resolution for running server services under plain Node
// (native TypeScript type stripping): resolves the "@/" alias and
// extensionless imports, and stubs Next.js server-only modules.
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const stubs = {
  "server-only": "export {};",
  "next/headers": "export async function headers(){ return new Map(); } export async function cookies(){ return { get(){}, getAll(){ return []; }, set(){} }; }",
  "next/cache": "export function revalidatePath(){} export function revalidateTag(){} export function unstable_cache(fn){ return fn; }",
  "next/navigation": "export function redirect(u){ const e = new Error('NEXT_REDIRECT'); e.digest = 'NEXT_REDIRECT;replace;' + u + ';307;'; throw e; } export function notFound(){ const e = new Error('NEXT_NOT_FOUND'); e.digest = 'NEXT_HTTP_ERROR_FALLBACK;404'; throw e; }",
};

function tryFile(base) {
  for (const ext of ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx", "/index.js"]) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

export function resolve(specifier, context, next) {
  if (specifier in stubs) return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const file = tryFile(path.join(root, specifier.slice(2)));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const file = tryFile(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  return next(specifier, context);
}
