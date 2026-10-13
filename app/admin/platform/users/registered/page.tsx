import type { SearchParams } from "@/lib/bos/params";
import { UsersList } from "../_shared/UsersList";

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  return <UsersList view="registered" searchParams={searchParams} />;
}
