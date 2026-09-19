import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

// The seller dashboard has its own look (see globals.css's "dash-"
// design tokens) modeled on a reference dashboard the shop owner asked
// us to match — including this typeface. Scoped to this route only
// (next/font className applied to a wrapper here, not the root layout)
// so the rest of the public site keeps its own existing font.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Seller dashboard — Buyam Sellam",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className={jakarta.className}>{children}</div>;
}
