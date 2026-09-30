export function storageUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${cleanPath}`;
}
