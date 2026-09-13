"use client";

import { useLocale } from "./locale-provider";

// Manual override for the automatic browser-language detection —
// small enough to sit in the header without crowding it.
export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center rounded-full border border-neutral-300 text-xs font-semibold overflow-hidden">
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-current={locale === "en"}
        className={`px-2.5 py-1 ${
          locale === "en" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-900"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("fr")}
        aria-current={locale === "fr"}
        className={`px-2.5 py-1 ${
          locale === "fr" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-900"
        }`}
      >
        FR
      </button>
    </div>
  );
}
