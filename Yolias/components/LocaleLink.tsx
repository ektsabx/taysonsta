"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useI18n } from "@/lib/i18n/client";
import { localizedHref } from "@/lib/i18n/paths";

/**
 * next/link that keeps the reader in their language on the website (D-258):
 * on an Arabic page, "/pricing" becomes "/ar/pricing"; app and sign-in links
 * stay as they are.
 */
export default function LocaleLink({ href, ...rest }: ComponentProps<typeof Link>) {
  const { locale } = useI18n();
  return <Link href={typeof href === "string" ? localizedHref(href, locale) : href} {...rest} />;
}
