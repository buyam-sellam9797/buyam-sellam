import { Plus_Jakarta_Sans } from "next/font/google";

// Same typeface as the seller dashboard, scoped to the sign-in and
// sign-up screens so they feel like the front door to it.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className={jakarta.className}>{children}</div>;
}
