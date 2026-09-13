import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buyam Sellam — Shop Douala Fashion & Beauty",
  description:
    "Buyam Sellam is Douala's online marketplace for fashion and beauty — real sellers, pay by mobile money, held safely until you confirm delivery.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">
        <header className="border-b border-neutral-200 bg-white sticky top-0 z-10">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-xl font-bold tracking-tight">
                Buyam<span className="text-amber-600">Sellam</span>
              </span>
              <span className="hidden sm:inline text-xs text-neutral-500">
                Douala
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium">
              <Link href="/browse" className="hover:text-amber-600">
                Browse
              </Link>
              <Link href="/sell" className="hover:text-amber-600">
                Sell on Buyam Sellam
              </Link>
              <Link
                href="/sell"
                className="rounded-full bg-neutral-900 text-white px-4 py-1.5 hover:bg-neutral-700"
              >
                Open a shop
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-neutral-200 bg-white mt-16">
          <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-neutral-500 flex flex-col sm:flex-row gap-2 sm:justify-between">
            <p>&copy; {new Date().getFullYear()} Buyam Sellam. Douala, Cameroon.</p>
            <p>Pay with MTN Mobile Money or Orange Money.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
