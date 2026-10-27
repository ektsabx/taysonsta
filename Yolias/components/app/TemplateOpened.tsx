"use client";

import { useEffect } from "react";
import { clearTemplate } from "@/app/(app)/template-actions";

/** Clears the website template once Yolias AI has shown its request. */
export function TemplateOpened() {
  useEffect(() => { void clearTemplate(); }, []);
  return null;
}
