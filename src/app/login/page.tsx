"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase, getMyProfile } from "@/lib/supabase";
import { useLocale } from "@/components/locale-provider";

// Where to go after logging in. ?next=/product/... sends people back to
// what they were doing (making an offer, sharing a bag); only same-site
// paths are followed.
function destinationFor(role: string | null | undefined, next: string | null): string {
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;
  if (role === "admin") return safeNext ?? "/admin";
  if (safeNext) return safeNext;
  return role === "seller" ? "/dashboard" : "/account";
}
import {
  AuthShell,
  AuthField,
  PasswordField,
  AuthError,
  AuthNotice,
  AuthSubmit,
  TrustFooter,
  LogInIcon,
} from "@/components/auth-card";

const REMEMBERED_EMAIL_KEY = "bs_remembered_email";

// One login form for buyers, sellers and admins. After signing in,
// each person is sent to their own home base based on their profile
// role. "Remember my email" only pre-fills the email field on this
// device — it never keeps anyone signed in past the inactivity limit.
function LoginForm() {
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const signedOutForIdle = searchParams.get("reason") === "idle";

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEmail(saved);
        setRemember(true);
      }
    } catch {
      // Storage blocked (private mode etc.) — the field just starts empty.
    }
  }, []);

  // Already logged in (another tab, or "Remember me"): skip the form.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session || cancelled) return;
      const profile = await getMyProfile();
      if (!cancelled) window.location.replace(destinationFor(profile?.role, searchParams.get("next")));
    });
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  function friendlyError(message: string): string {
    const m = message.toLowerCase();
    if (m.includes("invalid login credentials")) return t.auth.errorInvalidCredentials;
    if (m.includes("email not confirmed")) return t.auth.errorEmailNotConfirmed;
    return t.auth.errorGeneric;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setSubmitting(false);
      setError(friendlyError(error.message));
      return;
    }
    try {
      if (remember) localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
      else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    } catch {
      // Not critical.
    }
    const profile = await getMyProfile();
    // A full page load (not the in-app router) so the destination always
    // opens, with the new session already in place.
    window.location.assign(destinationFor(profile?.role, searchParams.get("next")));
  }

  return (
    <AuthShell
      icon={<LogInIcon className="w-6 h-6" />}
      title={t.auth.loginTitle}
      subtitle={t.auth.loginSubtitle}
      panelHeadline={t.auth.loginPanelHeadline}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {signedOutForIdle && <AuthNotice>{t.auth.idleSignedOut}</AuthNotice>}
        <AuthField
          id="email"
          label={t.auth.email}
          type="email"
          required
          autoComplete="email"
          placeholder={t.auth.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          id="password"
          label={t.auth.password}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />
        <div className="flex items-center justify-between gap-3 -mt-1">
          <label className="inline-flex items-center gap-2 text-sm text-neutral-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded border-neutral-300 accent-neutral-900"
            />
            {t.auth.rememberEmail}
          </label>
          <Link href="/forgot-password" className="text-sm font-semibold text-neutral-900 hover:text-amber-600">
            {t.auth.forgotPassword}
          </Link>
        </div>
        {error && <AuthError>{error}</AuthError>}
        <AuthSubmit disabled={submitting}>
          <LogInIcon className="w-4 h-4" />
          {submitting ? t.auth.loggingIn : t.auth.loginSubmit}
        </AuthSubmit>
      </form>

      <p className="text-sm text-neutral-500 text-center mt-6">
        {t.auth.noAccount}{" "}
        <Link href="/signup" className="font-semibold text-neutral-900 hover:text-amber-600">
          {t.auth.createFreeAccount}
        </Link>
      </p>
      <p className="text-xs text-neutral-400 text-center mt-2">
        {t.auth.guestNote}{" "}
        <Link href="/browse" className="underline hover:text-neutral-900">
          {t.auth.browseAsGuest}
        </Link>
      </p>

      <TrustFooter />
    </AuthShell>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary so the page can still be
  // statically prerendered.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
