import "server-only";
import type { IncomingMail, MailboxProvider } from "./types";

// A mailbox for local development and automated tests only (D-228). It never
// reaches the internet: "sent" messages are kept in this process, and tests
// add replies with pushTestReply(). Refused in production (testMailboxAllowed).

export function testMailboxAllowed(): boolean {
  return process.env.YOLIAS_TEST_MAILBOX === "1" && process.env.NODE_ENV !== "production";
}

const sent: { id: string; threadId: string; to: string; subject: string; body: string; unsubscribeUrl: string | null }[] = [];
const inbox: IncomingMail[] = [];
let seq = 0;

export const testOutbox = () => [...sent];
export function pushTestReply(m: Omit<IncomingMail, "providerMessageId" | "receivedAt" | "bounce"> & { bounce?: boolean }) {
  inbox.push({ ...m, providerMessageId: `test-in-${++seq}-${Date.now()}`, receivedAt: new Date().toISOString(), bounce: m.bounce ?? false });
}

export const testProvider: MailboxProvider = {
  id: "test",
  async configured() { return testMailboxAllowed(); },
  async authorizeUrl() { throw new Error("the test mailbox is connected without OAuth"); },
  async exchange() { throw new Error("the test mailbox is connected without OAuth"); },
  async accessToken() { return { token: "test", expiresAt: Date.now() + 3_600_000 }; },
  async send(_token, mail) {
    if (!testMailboxAllowed()) throw new Error("test mailbox not allowed here");
    const id = `test-out-${++seq}-${Date.now()}`;
    const threadId = mail.threadId ?? `test-thread-${id}`;
    sent.push({ id, threadId, to: mail.to, subject: mail.subject, body: mail.body, unsubscribeUrl: mail.unsubscribeUrl ?? null });
    return { providerMessageId: id, threadId };
  },
  async replies(_token, _own, threadIds) {
    const want = new Set(threadIds);
    return inbox.filter((m) => want.has(m.threadId));
  },
};
