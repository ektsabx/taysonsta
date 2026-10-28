// Mailbox providers (D-228): the member's own Gmail or Outlook account, used
// to send campaign messages and read the replies to them. Official APIs only
// (Gmail API, Microsoft Graph) with the member's OAuth consent; no scraping.

import type { MailProvider } from "@/types/database";

export interface OutgoingMail {
  from: string;
  fromName: string | null;
  to: string;
  subject: string;
  body: string;
  /** Continue a thread: the provider's thread / conversation id and the last message we sent in it. */
  threadId?: string | null;
  replyToProviderId?: string | null;
  /** Campaign emails: the one-click unsubscribe address for the List-Unsubscribe header (Gmail, SMTP; Graph allows only X- headers). */
  unsubscribeUrl?: string | null;
}

export interface SentMail {
  providerMessageId: string;
  threadId: string | null;
}

export interface IncomingMail {
  providerMessageId: string;
  threadId: string;
  from: string;
  fromName: string | null;
  subject: string;
  body: string;
  receivedAt: string;
  /** A delivery failure notice (the provider bounced our message). */
  bounce: boolean;
  /** An out-of-office or other automatic reply, told by its headers or subject (isAutoReply). */
  autoReply?: boolean;
}

export interface ConnectedAccount {
  refreshToken: string;
  email: string;
  displayName: string | null;
  canRead: boolean;
}

/** Errors a caller acts on: auth = reconnect needed; rate = try later; rejected = this message can't be sent. */
export class MailboxError extends Error {
  constructor(public kind: "auth" | "rate" | "rejected" | "unavailable" | "not_configured", message: string) {
    super(message);
  }
}

export interface MailboxProvider {
  id: MailProvider;
  configured(): Promise<boolean>;
  authorizeUrl(state: string, redirectUri: string): Promise<string>;
  exchange(code: string, redirectUri: string): Promise<ConnectedAccount>;
  accessToken(refreshToken: string): Promise<{ token: string; expiresAt: number }>;
  send(token: string, mail: OutgoingMail): Promise<SentMail>;
  /** New messages in these threads that weren't sent by `ownAddress`. */
  replies(token: string, ownAddress: string, threadIds: string[]): Promise<IncomingMail[]>;
}
