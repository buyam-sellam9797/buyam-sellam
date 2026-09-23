"use client";

import { useLocale } from "./locale-provider";

// Manual override for the automatic browser-language detection. Shows
// only the language you can switch TO: "FR" while the site is in
// English, "EN" while it is in French — one small button instead of a
// two-part toggle, so it always fits in the header on phones.
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();
  const next = locale === "en" ? "fr" : "en";

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      lang={next}
      aria-label={t.nav.switchLanguage}
      title={t.nav.switchLanguage}
      className="shrink-0 rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
    >
      {next.toUpperCase()}
    </button>
  );
}
