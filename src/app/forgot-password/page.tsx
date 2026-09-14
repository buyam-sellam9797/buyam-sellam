"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/components/locale-provider";

export default function ForgotPasswordPage() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    // Deliberately show the same success message whether or not the email
    // has an account — this is a public form and we don't want it usable
    // to check which emails are registered sellers.
    if (error) {
      setError(t.forgotPassword.errorGeneric);
      return;
    }
    setSent(true);
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold mb-1">{t.forgotPassword.title}</h1>
      <p className="text-neutral-500 text-sm mb-8">{t.forgotPassword.subtitle}</p>

      {sent ? (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-3">
          {t.forgotPassword.success}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="text-sm font-medium block mb-2" htmlFor="email">
              {t.forgotPassword.email}
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
            {submitting ? t.forgotPassword.sending : t.forgotPassword.submit}
          </button>
        </form>
      )}

      <p className="text-xs text-neutral-500 text-center mt-6">
        <Link href="/login" className="text-amber-600 hover:underline">
          {t.forgotPassword.backToLogin}
        </Link>
      </p>
    </div>
  );
}
