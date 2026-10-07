import type { ProviderAdapter } from "@/lib/intel/adapter";
import { webDiscovery } from "./web-discovery";

// Provider adapters in code (docs/10-roadmap.md phase 4, decision D-003).
// Each adapter goes in its own file here and is listed below; Yolias then
// adds its registry row (disabled) and the admin configures and enables it.
// Never add a mock adapter that returns invented data (rule 4): the website
// discovery adapter (D-164) stores only what a business's own site publishes.
export const adapters: ProviderAdapter[] = [webDiscovery];
