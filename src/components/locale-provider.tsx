"use client";

import { createContext, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getDictionary, type Dictionary, type Locale } from "@/lib/i18n";

type LocaleContextValue = {
  locale: Locale;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

// Wraps the whole app (see layout.tsx) so client components — forms,
// the dashboard, anything with "use client" — can read the current
// language the same way server components do, without each one
// needing to read cookies itself.
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: getDictionary(locale),
      setLocale: (next: Locale) => {
        document.cookie = `locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
        router.refresh();
      },
    }),
    [locale, router]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used inside <LocaleProvider>");
  }
  return ctx;
}
