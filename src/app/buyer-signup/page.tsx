"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBuyerAccount } from "@/lib/supabase";
import { useLocale } from "@/components/locale-provider";
import { isPasswordStrongEnough, PASSWORD_MIN_LENGTH } from "@/lib/password";

export default function BuyerSignupPage() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isPasswordStrongEnough(password)) {
      setError(t.resetPassword.errorTooShort);
      return;
    }
    setSubmitting(true);
    try {
      const result = await createBuyerAccount({ fullName, email, password, phone, city, locale });
      if (!result.hasSession) {
        setNeedsEmailConfirm(true);
        return;
      }
      router.push("/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.buyerSignup.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  if (needsEmailConfirm) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center">
        <h1 className="text-xl font-bold mb-2">{t.buyerSignup.almostThere}</h1>
        <p className="text-neutral-600 text-sm">
          {t.buyerSignup.checkEmailPrefix} {email} {t.buyerSignup.checkEmailSuffix}{" "}
          <Link href="/login" className="text-amber-600 hover:underline">
            {t.buyerSignup.logIn}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold mb-1">{t.buyerSignup.title}</h1>
      <p className="text-neutral-500 text-sm mb-8">{t.buyerSignup.subtitle}</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium block mb-2" htmlFor="fullName">
            {t.buyerSignup.fullName}
          </label>
          <input
            id="fullName"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-2" htmlFor="email">
            {t.buyerSignup.email}
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
          <label className="text-sm font-medium block mb-2" htmlFor="password">
            {t.buyerSignup.password}
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-2" htmlFor="phone">
            {t.buyerSignup.phone}
          </label>
          <input
            id="phone"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.buyerSignup.phonePlaceholder}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-2" htmlFor="city">
            {t.buyerSignup.city}
          </label>
          <input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={t.buyerSignup.cityPlaceholder}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700 disabled:opacity-60"
        >
          {submitting ? t.buyerSignup.creating : t.buyerSignup.submit}
        </button>
      </form>

      <p className="text-xs text-neutral-500 text-center mt-6">
        {t.buyerSignup.haveAccount}{" "}
        <Link href="/login" className="text-amber-600 hover:underline">
          {t.buyerSignup.logIn}
        </Link>
      </p>
    </div>
  );
}
