import { redirect } from "next/navigation";

// The affiliate program has its own portal now, outside the app (owner, 2026-10-13, D-206).
export default function AffiliatePage() {
  redirect("/partners");
}
