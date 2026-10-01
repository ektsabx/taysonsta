import type { ProviderAdapter } from "@/lib/intel/adapter";

// Provider adapters in code. Empty until the first production-grade
// integration (docs/10-roadmap.md phase 4, decision D-003). Each adapter goes
// in its own file here and is listed below; Yolias then adds its registry row
// (disabled) and the admin configures and enables it. Never add a mock
// adapter that returns invented data (rule 4).
export const adapters: ProviderAdapter[] = [];
