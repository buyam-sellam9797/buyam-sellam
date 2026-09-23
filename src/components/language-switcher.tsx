"use client";

import { useTransition } from "react";
import { useLocale } from "./locale-provider";

// Manual override for the automatic browser-language detection. Shows
// only the language you can switch TO: "FR" while the site is in
// English, "EN" while it is in French — one small button instead of a
// two-part toggle, so it always fits in the header on phones.
//
// Switching re-renders the page on the server in the new language,
// which takes a moment. The switch runs inside a React transition so
// the button can show it is working (spinner, dimmed, not clickable
// twice) until the translated page has arrived.
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();
  const [isPending, startTransition] = useTransition();
  const next = locale === "en" ? "fr" : "en";

  return (
    <button
      type="button"
      onClick={() => startTransition(() => setLocale(next))}
      disabled={isPending}
      aria-busy={isPending}
      lang={next}
      aria-label={t.nav.switchLanguage}
      title={t.nav.switchLanguage}
      className="shrink-0 inline-flex items-center justify-center gap-1 min-w-[2.5rem] rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-900 hover:bg-neutral-900 hover:text-white active:scale-95 disabled:cursor-wait disabled:opacity-60"
    >
      {isPending ? (
        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : (
        next.toUpperCase()
      )}
    </button>
  );
}
