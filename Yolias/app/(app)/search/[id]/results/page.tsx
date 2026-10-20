import { notFound, redirect } from "next/navigation";

// The Search results view was removed (owner, 2026-10-20): a search lives in
// its Yolias AI conversation, its prospects in Prospects. Old links and the
// browser's Back land on the conversation.
export default async function SearchResultsPage({ params }: PageProps<"/search/[id]/results">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  redirect(`/search/${id}`);
}
