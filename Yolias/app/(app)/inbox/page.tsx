import { redirect } from "next/navigation";

// The Inbox is the "Conversations" tab of /conversations now (D-249); old links keep working.
export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  for (const k of ["lead", "filter", "q"]) {
    const v = sp[k];
    const one = Array.isArray(v) ? v[0] : v;
    if (one) p.set(k, one);
  }
  redirect(p.size ? `/conversations?${p}` : "/conversations");
}
