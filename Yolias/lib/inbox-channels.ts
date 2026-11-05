// What the reply box offers depends on the channel of the conversation (owner,
// 2026-11-05). A new channel is one more entry here.
export type ReplyTool = "file" | "image" | "gif" | "emoji" | "voice";
export type InboxChannel = "email";
export const CHANNEL_TOOLS: Record<InboxChannel, ReplyTool[]> = { email: ["file", "image", "gif", "emoji", "voice"] };
export const toolsFor = (channel: string | null | undefined): ReplyTool[] => CHANNEL_TOOLS[(channel ?? "email") as InboxChannel] ?? CHANNEL_TOOLS.email;

export interface InboxFile { path: string; name: string; type: string; size: number }
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 5;
export const cleanTag = (v: string) => v.trim().replace(/\s+/g, " ").slice(0, 40);
