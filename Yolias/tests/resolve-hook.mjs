import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function withExtension(file) {
  if (/\.[cm]?[jt]sx?$/.test(file) && existsSync(file)) return file;
  for (const candidate of [`${file}.ts`, `${file}.tsx`, path.join(file, "index.ts")]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  let target = null;
  if (specifier.startsWith("@/")) target = path.join(root, specifier.slice(2));
  else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (target) {
    const file = withExtension(target);
    if (file) return next(pathToFileURL(file).href, context);
  }
  return next(specifier, context);
}
