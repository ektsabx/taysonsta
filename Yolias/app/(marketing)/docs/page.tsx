import { redirect } from "next/navigation";
import { docPages } from "@/lib/content/store";

export default async function DocsIndex() {
  const docs = await docPages();
  redirect(`/docs/${docs[0]?.slug ?? "introduction"}`);
}
