import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { LocaleProvider } from "@/components/locale-provider";
import { LanguageSwitcher } from "@/components/language-switcher";

export const metadata: Metadata = {
  title: "Buyam Sellam — Shop Douala Fashion & Beauty",
  description:
    "Buyam Sellam is Douala's online marketplace for fashion and beauty — real sellers, pay by mobile money, held safely until you confirm delivery.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">
        <LocaleProvider locale={locale}>
          <header className="border-b border-neutral-200 bg-white sticky top-0 z-10">
            <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
              <Link href="/" className="flex items-baseline gap-2">
                <span className="text-xl font-bold tracking-tight">
                  Buyam<span className="text-amber-600">Sellam</span>
                </span>
                <span className="hidden sm:inline text-xs text-neutral-500">
                  {t.nav.city}
                </span>
              </Link>
              <nav className="flex items-center gap-4 text-sm font-medium">
                <Link href="/browse" className="hover:text-amber-600">
                  {t.nav.browse}
                </Link>
                <Link href="/sell" className="hidden sm:inline hover:text-amber-600">
                  {t.nav.sell}
                </Link>
                <Link
                  href="/sell"
                  className="rounded-full bg-neutral-900 text-white px-4 py-1.5 hover:bg-neutral-700"
                >
                  {t.nav.openShop}
                </Link>
                <LanguageSwitcher />
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-neutral-200 bg-white mt-16">
            <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-neutral-500 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-between">
                <p>&copy; {new Date().getFullYear()} {t.footer.rights}</p>
                <p>{t.footer.payWith}</p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <Link href="/privacy" className="hover:text-amber-600">
                  {t.footer.privacy}
                </Link>
                <Link href="/terms" className="hover:text-amber-600">
                  {t.footer.terms}
                </Link>
                <Link href="/refund" className="hover:text-amber-600">
                  {t.footer.refund}
                </Link>
              </div>
            </div>
          </footer>
        </LocaleProvider>
      </body>
    </html>
  );
}
