import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = {
  ...defineCloudflareConfig(),
  // next build + a file-trace fix for the proxy bundle (scripts/cf-build.mjs).
  buildCommand: "npm run build:cf-next",
};

export default config;
