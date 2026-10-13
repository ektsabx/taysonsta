import { yoliasSiteUrl } from "@/lib/yolias/db";
export { NotConnected, connected } from "@/components/yolias/PlatformUi";
export const yoliasLink = (path: string) => `${yoliasSiteUrl()}${path}`;
