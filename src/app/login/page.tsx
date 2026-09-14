"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, getMyProfile } from "@/lib/supabase";
import { useLocale } from "@/components/locale-provider";

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
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold mb-1">{t.login.title}</h1>
      <p className="text-neutral-500 text-sm mb-8">{t.login.subtitle}</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
        <p className="text-xs text-neutral-500 text-center">
          {t.login.noAccountYet}{" "}
          <Link href="/buyer-signup" className="text-amber-600 hover:underline">
            {t.login.createBuyerAccount}
          </Link>
        </p>
        <p className="text-xs text-neutral-500 text-center">
          {t.login.noShopYet}{" "}
          <Link href="/sell" className="text-amber-600 hover:underline">
            {t.login.openForFree}
          </Link>
        </p>
      </form>
    </div>
  );
}
