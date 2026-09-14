import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getLocale } from "@/lib/get-locale";
import { getDictionary } from "@/lib/i18n";
import { LocaleProvider } from "@/components/locale-provider";
import { LanguageSwitcher } from "@/components/language-switcher";

export const metadata: Metadata = {
  title: "Buyam Sellam — Shop Cameroon. Buy with Confidence.",
  description:
    "Buyam Sellam is Cameroon's trusted online marketplace for fashion and beauty — verified sellers, pay by MTN MoMo or Orange Money, held safely until you confirm delivery.",
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
                <Link href="/shops" className="hidden sm:inline hover:text-amber-600">
                  {t.footer.verifiedSellers}
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
            <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-neutral-500">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
                <div>
                  <p className="text-xs font-semibold text-neutral-900 mb-3">{t.footer.shopHeading}</p>
                  <ul className="space-y-2 text-xs">
                    <li>
                      <Link href="/browse" className="hover:text-amber-600">
                        {t.footer.browse}
                      </Link>
                    </li>
                    <li>
                      <Link href="/shops" className="hover:text-amber-600">
                        {t.footer.verifiedSellers}
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-900 mb-3">{t.footer.sellHeading}</p>
                  <ul className="space-y-2 text-xs">
                    <li>
                      <Link href="/sell" className="hover:text-amber-600">
                        {t.footer.openShop}
                      </Link>
                    </li>
                    <li>
                      <Link href="/login" className="hover:text-amber-600">
                        {t.footer.sellerLogin}
                      </Link>
                    </li>
                    <li>
                      <Link href="/help#selling" className="hover:text-amber-600">
                        {t.footer.sellerGuide}
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-900 mb-3">{t.footer.helpHeading}</p>
                  <ul className="space-y-2 text-xs">
                    <li>
                      <Link href="/help" className="hover:text-amber-600">
                        {t.footer.helpCentre}
                      </Link>
                    </li>
                    <li>
                      <Link href="/help#buyer-protection" className="hover:text-amber-600">
                        {t.footer.buyerProtection}
                      </Link>
                    </li>
                    <li>
                      <Link href="/refund" className="hover:text-amber-600">
                        {t.footer.refund}
                      </Link>
                    </li>
                    <li>
                      <Link href="/help#contact" className="hover:text-amber-600">
                        {t.footer.contactUs}
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-900 mb-3">{t.footer.legalHeading}</p>
                  <ul className="space-y-2 text-xs">
                    <li>
                      <Link href="/privacy" className="hover:text-amber-600">
                        {t.footer.privacy}
                      </Link>
                    </li>
                    <li>
                      <Link href="/terms" className="hover:text-amber-600">
                        {t.footer.terms}
                      </Link>
                    </li>
                    <li>
                      <Link href="/refund" className="hover:text-amber-600">
                        {t.footer.refund}
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-neutral-100 flex flex-col sm:flex-row gap-2 sm:justify-between text-xs">
                <p>&copy; {new Date().getFullYear()} {t.footer.rights}</p>
                <p>{t.footer.payWith}</p>
              </div>
            </div>
          </footer>
        </LocaleProvider>
      </body>
    </html>
  );
}
