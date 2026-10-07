// Where this build runs and which commit it is, for Sentry and PostHog, so
// local, staging and production data never mix. NEXT_PUBLIC_APP_ENV is set by
// the production build (.env.production.local); anything else is "local".
export type AppEnv = "local" | "staging" | "production";

export const appEnv: AppEnv = ((): AppEnv => {
  const v = process.env.NEXT_PUBLIC_APP_ENV;
  return v === "production" || v === "staging" ? v : "local";
})();

/** Git commit of the build (next.config.ts), e.g. "yolias@80f1b9c". */
export const release = process.env.NEXT_PUBLIC_RELEASE || undefined;
