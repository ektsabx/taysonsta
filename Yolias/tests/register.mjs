// Lets node:test load app modules: resolves the "@/…" alias to the project
// root and extension-less relative imports to .ts / .tsx files.
import { register } from "node:module";
register("./resolve-hook.mjs", import.meta.url);
