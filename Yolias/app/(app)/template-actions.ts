"use server";

import { cookies } from "next/headers";
import { TEMPLATE_COOKIE } from "@/lib/content/seo-pages";

/** The template's request is in the composer: forget it, so it opens once. */
export async function clearTemplate(): Promise<void> {
  (await cookies()).delete(TEMPLATE_COOKIE);
}
