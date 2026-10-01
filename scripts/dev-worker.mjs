#!/usr/bin/env node
// Local stand-in for the production Cron Trigger (docs/05 "Queue & worker"):
// calls Yolias's /api/worker every few seconds so queued discovery jobs run.
import { readFileSync } from "node:fs";

const url = process.env.WORKER_URL || "http://127.0.0.1:3201/api/worker";
const every = Number(process.env.WORKER_INTERVAL_MS || 3000);
const env = readFileSync(new URL("../Yolias/.env.local", import.meta.url), "utf8");
const secret = env.match(/^WORKER_SECRET=(.+)$/m)?.[1]?.trim();
if (!secret) {
  console.error("✖ WORKER_SECRET missing in Yolias/.env.local — run npm run local.");
  process.exit(1);
}

let quietSince = 0;
async function loop() {
  try {
    const res = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(60_000) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) console.error(`worker ${res.status}: ${body.error ?? ""}`);
    else if (body.taken) console.log(`jobs: ${body.taken} taken · ${body.succeeded} ok · ${body.retried} retry · ${body.dead} failed`);
    quietSince = 0;
  } catch {
    // The app is still starting: stay quiet for a while.
    if (++quietSince === 20) console.error("worker: Yolias isn't answering yet…");
  }
  setTimeout(loop, every);
}
console.log(`▸ Worker polling ${url} every ${every / 1000}s`);
loop();
