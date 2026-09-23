"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, getMyProfile, getMyShop } from "@/lib/supabase";
import { useLocale } from "@/components/locale-provider";

type AuthState =
  | { kind: "checking" }
  | { kind: "loggedOut" }
  | { kind: "admin" }
  | { kind: "seller" }
  | { kind: "buyer" };

// The header used to show one static "Account" link no matter who was
// looking at it — signed out, a signed-in buyer, and a signed-in
// seller with an active shop all saw the same word. A seller had to
// click through to /account, wait for it to load, and find the
// "go to my dashboard" link buried there — and someone signed out saw
// no clearly-labeled way to log in at all, just "Account" sitting next
// to "Open a shop" with no visual difference in weight. This checks
// auth state once (and again on every login/logout, e.g. after the
// login page's own redirect) so the header can point straight to
// wherever that person actually needs to go, and reacts immediately —
// no page reload — when they log in or out elsewhere on the site.
export function HeaderAuthNav() {
  const { t } = useLocale();
  const [state, setState] = useState<AuthState>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setState({ kind: "loggedOut" });
        return;
      }
      const [profile, shop] = await Promise.all([getMyProfile(), getMyShop()]);
      if (cancelled) return;
      if (profile?.role === "admin") setState({ kind: "admin" });
      else if (shop) setState({ kind: "seller" });
      else setState({ kind: "buyer" });
    }

    resolve();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      resolve();
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Nothing rendered while state is still resolving — briefly blank
  // rather than flashing "Log in" for someone who turns out to already
  // be signed in.
  if (state.kind === "checking") {
    return null;
  }

  // The plain text link (Log in / My account / Admin) is shown on every
  // screen size, including phones — people on mobile need a way to log
  // in too. To make room, the sell pill shortens to "Sell" on phones and
  // "Browse" becomes an icon (see layout.tsx). Whichever pill applies to
  // this person (Open a shop / Dashboard) fully replaces the other
  // rather than the two ever appearing side by side.
  if (state.kind === "loggedOut") {
    return (
      <>
        <Link href="/login" className="hover:text-amber-600">
          <span className="sm:hidden">{t.nav.loginShort}</span>
          <span className="hidden sm:inline">{t.nav.login}</span>
        </Link>
        <SellPill label={t.nav.openShop} short={t.nav.sell} />
      </>
    );
  }

  if (state.kind === "admin") {
    return (
      <Link href="/admin" className="hover:text-amber-600">
        {t.nav.admin}
      </Link>
    );
  }

  if (state.kind === "seller") {
    // Already runs a shop — "Open a shop" would be a confusing second
    // CTA here, so the dashboard link (in the brand accent, to stand
    // out the way "Open a shop" used to) fully replaces it rather than
    // sitting next to it.
    return (
      <Link
        href="/dashboard"
        className="rounded-full bg-amber-500 text-white font-semibold px-3 sm:px-4 py-1.5 hover:bg-amber-600"
      >
        {t.nav.dashboard}
      </Link>
    );
  }

  return (
    <>
      <Link href="/account" className="hover:text-amber-600">
        {t.nav.account}
      </Link>
      <SellPill label={t.nav.openShop} short={t.nav.sell} />
    </>
  );
}

// "Open a shop" on wider screens, just "Sell" on phones, so the header
// stays on one line at 360–390px wide.
function SellPill({ label, short }: { label: string; short: string }) {
  return (
    <Link href="/become-seller" className="rounded-full bg-neutral-900 text-white px-3 sm:px-4 py-1.5 hover:bg-neutral-700">
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
