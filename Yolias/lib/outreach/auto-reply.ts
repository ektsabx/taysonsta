// An inbound message Yolias marked as an automatic reply (out of office,
// vacation responder): stored and shown in the Inbox's Out of office tab,
// but never counted as the lead replying (owner, 2026-10-28).
export function isAutoReplyRow(m: { analysis?: unknown }): boolean {
  return (m.analysis as { kind?: string } | null | undefined)?.kind === "out_of_office";
}
