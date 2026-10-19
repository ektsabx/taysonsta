import "server-only";
import { MailboxError } from "./types";

// A small line-oriented TCP/TLS connection for SMTP and IMAP (D-238). Uses
// node:net / node:tls, which run on Node and on Cloudflare Workers with
// nodejs_compat. Bytes are kept as Buffers so IMAP literals ({n} bytes) are
// counted exactly; lines are read as latin1 (byte-preserving) text.

export type Security = "tls" | "starttls" | "none";
export interface Endpoint { host: string; port: number; security: Security }

type Sock = import("node:net").Socket | import("node:tls").TLSSocket;

// Host names only (an IP literal never matches the name pattern below), and never internal names.
const PRIVATE = /^(localhost|.*\.(local|internal|localdomain|lan|home|corp))$/i;

/** Tests and local development may talk to a local stand-in without TLS; production never. */
export function localMailAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.YOLIAS_TEST_MAILBOX === "1";
}

/** Only real mail servers on mail ports (no private hosts, no arbitrary ports). */
export function checkEndpoint(ep: Endpoint, kind: "imap" | "smtp"): void {
  const ports = kind === "imap" ? [993, 143] : [465, 587, 2525];
  const local = localMailAllowed() && /^(127\.0\.0\.1|localhost)$/.test(ep.host);
  if (!local) {
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(ep.host) || PRIVATE.test(ep.host)) throw new MailboxError("rejected", "invalid_host");
    if (!ports.includes(ep.port)) throw new MailboxError("rejected", "invalid_port");
    if (ep.security === "none") throw new MailboxError("rejected", "insecure");
  }
}

export class LineConn {
  private buf = Buffer.alloc(0);
  private waiters: (() => void)[] = [];
  private ended: Error | null = null;

  private constructor(private sock: Sock, private timeoutMs: number) {
    this.attach(sock);
  }

  private attach(sock: Sock) {
    sock.on("data", (d: Buffer) => { this.buf = Buffer.concat([this.buf, d]); this.wake(); });
    sock.on("error", (e: Error) => { this.ended = e; this.wake(); });
    sock.on("close", () => { this.ended ??= new Error("connection closed"); this.wake(); });
  }

  private wake() {
    const w = this.waiters;
    this.waiters = [];
    for (const f of w) f();
  }

  private wait(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new MailboxError("unavailable", "mail server timeout")), this.timeoutMs);
      this.waiters.push(() => { clearTimeout(timer); resolve(); });
    });
  }

  static async open(ep: Endpoint, timeoutMs = 20_000): Promise<LineConn> {
    const net = await import("node:net");
    const tls = await import("node:tls");
    const sock: Sock = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new MailboxError("unavailable", "connect_timeout")), timeoutMs);
      const done = (s: Sock) => { clearTimeout(timer); resolve(s); };
      const fail = (e: Error) => { clearTimeout(timer); reject(new MailboxError("unavailable", `connect_failed: ${e.message}`)); };
      if (ep.security === "tls") {
        const s = tls.connect({ host: ep.host, port: ep.port, servername: ep.host }, () => done(s));
        s.once("error", fail);
      } else {
        const s = net.connect({ host: ep.host, port: ep.port }, () => done(s));
        s.once("error", fail);
      }
    });
    return new LineConn(sock, timeoutMs);
  }

  /** Upgrades a plain connection after STARTTLS. */
  async startTls(host: string): Promise<void> {
    const tls = await import("node:tls");
    const plain = this.sock as import("node:net").Socket;
    plain.removeAllListeners("data");
    plain.removeAllListeners("error");
    plain.removeAllListeners("close");
    this.buf = Buffer.alloc(0);
    this.sock = await new Promise((resolve, reject) => {
      const s = tls.connect({ socket: plain, servername: host }, () => resolve(s));
      s.once("error", (e) => reject(new MailboxError("unavailable", `tls_failed: ${e.message}`)));
    });
    this.ended = null;
    this.attach(this.sock);
  }

  async readLine(): Promise<string> {
    for (;;) {
      const i = this.buf.indexOf("\r\n");
      if (i >= 0) {
        const line = this.buf.subarray(0, i).toString("latin1");
        this.buf = this.buf.subarray(i + 2);
        return line;
      }
      if (this.ended) throw new MailboxError("unavailable", this.ended.message);
      await this.wait();
    }
  }

  async readBytes(n: number): Promise<Buffer> {
    while (this.buf.length < n) {
      if (this.ended) throw new MailboxError("unavailable", this.ended.message);
      await this.wait();
    }
    const out = this.buf.subarray(0, n);
    this.buf = this.buf.subarray(n);
    return Buffer.from(out);
  }

  write(data: string | Buffer): Promise<void> {
    return new Promise((resolve, reject) => this.sock.write(data, (e) => (e ? reject(new MailboxError("unavailable", e.message)) : resolve())));
  }

  close() {
    try { this.sock.end(); this.sock.destroy(); } catch { /* already closed */ }
  }
}
