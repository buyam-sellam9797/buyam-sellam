"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/components/locale-provider";

// Reached from the email link Supabase sends after /forgot-password.
// Supabase's client SDK reads the recovery token out of the URL on load
// (detectSessionInUrl, on by default) and fires a PASSWORD_RECOVERY auth
// event once that session is ready — we wait for that (or an existing
// session, if this page is reloaded) before letting the form submit, and
// give up after a few seconds if neither shows up, since that means the
// link was invalid or already used.
export default function ResetPasswordPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let settled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        settled = true;
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!settled && data.session) {
        settled = true;
        setReady(true);
      }
    });

    const timeout = setTimeout(() => {
      if (!settled) setInvalid(true);
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError(t.resetPassword.errorTooShort);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.resetPassword.errorMismatch);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setError(t.resetPassword.errorGeneric);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push("/login"), 1800);
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold mb-1">{t.resetPassword.title}</h1>
      <p className="text-neutral-500 text-sm mb-8">{t.resetPassword.subtitle}</p>

      {invalid ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-3">
            {t.resetPassword.invalidLink}
          </p>
          <Link
            href="/forgot-password"
            className="text-sm text-amber-600 hover:underline text-center"
          >
            {t.resetPassword.requestNewLink}
          </Link>
        </div>
      ) : success ? (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-3">
          {t.resetPassword.success}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="text-sm font-medium block mb-2" htmlFor="password">
              {t.resetPassword.newPassword}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              disabled={!ready}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-2" htmlFor="confirmPassword">
              {t.resetPassword.confirmPassword}
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={6}
              disabled={!ready}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
            />
          </div>
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={!ready || submitting}
            className="rounded-full bg-neutral-900 text-white font-semibold px-6 py-3 hover:bg-neutral-700 disabled:opacity-60"
          >
            {submitting ? t.resetPassword.updating : t.resetPassword.submit}
          </button>
        </form>
      )}
    </div>
  );
}
