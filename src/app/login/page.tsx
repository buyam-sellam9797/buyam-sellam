"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, getMyProfile } from "@/lib/supabase";
import { useLocale } from "@/components/locale-provider";
import { IconBag, IconBox } from "@/components/dash-icons";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setSubmitting(false);
      setError(error.message);
      return;
    }
    // One login form for buyers, sellers, and admins — route each to
    // their own home base based on the profile role rather than
    // assuming everyone who logs in is a seller.
    const profile = await getMyProfile();
    setSubmitting(false);
    if (profile?.role === "admin") {
      router.push("/admin");
    } else if (profile?.role === "seller") {
      router.push("/dashboard");
    } else {
      router.push("/account");
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      {/* This is the page most new visitors land on when they click
          "Account". It used to lead with a bare login form and bury the
          buy/sell choice as tiny text links underneath — confusing for
          someone who just wants to shop, since guest checkout needs no
          account at all. Now the choice comes first, and the buyer side
          of it is written to make clear signing up is a bonus, not a
          requirement. The login form for people who already have an
          account still lives right below, unchanged. */}
      <h1 className="text-2xl font-bold mb-6">{t.login.newHereTitle}</h1>

      <div className="flex flex-col gap-3 mb-8">
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="font-semibold mb-1 flex items-center gap-1.5">
            <IconBag className="w-4 h-4" /> {t.login.buyerCardTitle}
          </p>
          <p className="text-sm text-neutral-600 mb-4">{t.login.buyerCardBody}</p>
          <Link
            href="/browse"
            className="inline-block rounded-full bg-neutral-900 text-white text-sm font-semibold px-5 py-2.5 hover:bg-neutral-700"
          >
            {t.login.browseNow}
          </Link>
          <p className="text-xs text-neutral-500 mt-3">
            {t.login.buyerCardBonus}{" "}
            <Link href="/buyer-signup" className="text-amber-600 hover:underline">
              {t.login.createBuyerAccount}
            </Link>
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="font-semibold mb-1 flex items-center gap-1.5">
            <IconBox className="w-4 h-4" /> {t.login.sellerCardTitle}
          </p>
          <p className="text-sm text-neutral-600 mb-4">{t.login.sellerCardBody}</p>
          <Link
            href="/sell"
            className="inline-block rounded-full border border-neutral-900 text-sm font-semibold px-5 py-2.5 hover:bg-neutral-900 hover:text-white"
          >
            {t.login.startSelling}
          </Link>
        </div>
      </div>

      <div className="border-t border-neutral-200 pt-6">
        <p className="text-sm font-medium mb-4">{t.login.alreadyHaveAccount}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium block mb-2" htmlFor="email">
              {t.login.email}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium" htmlFor="password">
                {t.login.password}
              </label>
              <Link href="/forgot-password" className="text-xs text-amber-600 hover:underline">
                {t.login.forgotPassword}
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700 disabled:opacity-60"
          >
            {submitting ? t.login.loggingIn : t.login.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
