import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

// A pending payment's page (old links, D-235): Paymob's hosted page while the
// payment is pending, else its result (D-254: Paymob only).
export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: p } = await (await createClient()).from("payments").select("id, status, checkout_url").eq("id", id).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!p) notFound();
  redirect(p.status === "pending" && p.checkout_url ? p.checkout_url : `/billing/result?payment=${p.id}`);
}
