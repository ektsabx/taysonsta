import { redirect } from "next/navigation";
import { docs } from "@/lib/content/docs";

export default function DocsIndex() {
  redirect(`/docs/${docs[0].slug}`);
}
