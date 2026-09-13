import { cookies } from "next/headers";
import type { Locale } from "./i18n";

// Server Components (pages, layout) read the "locale" cookie that
// src/proxy.ts set on the visitor's first request. cookies() is async
// in this Next.js version.
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get("locale")?.value;
  return value === "fr" ? "fr" : "en";
}
