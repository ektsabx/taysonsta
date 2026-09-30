import "server-only";
import { db } from "@/lib/bos/db";
import { requestMeta } from "@/lib/bos/auth";

// Sign-in history (docs/bos/03, 30 §6): every attempt, success or failure,
// with the method. Never records passwords or tokens.
export async function recordLogin(email: string, userId: string | null, success: boolean, failureReason: string | null, method: "password" | "google" = "password") {
  const { ip, userAgent } = await requestMeta();
  await db()
    .from("login_history")
    .insert({ email, user_id: userId, success, failure_reason: failureReason, method, ip: ip && /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null, user_agent: userAgent });
}
