// What a conversation shows (D-270), on top of the Conversations tab: shared by
// the server list (services/master-inbox.ts) and its filter (MasterInbox).
export const INBOX_SHOWS = ["interested", "not_interested", "needs_you", "meeting_request", "booked", "replied", "no_reply"] as const;
export type InboxShow = (typeof INBOX_SHOWS)[number];
