"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFollowState, setFollowing } from "@/lib/supabase";
import { useLocale } from "@/components/locale-provider";
import { plural } from "@/lib/i18n";

// "Follow" on a shop's page. Followers get one email when the shop adds
// new products (at most every 12 hours). Needs an account, because the
// email goes to the account's address; signed-out visitors are sent to
// log in.
export function FollowButton({ shopId, initialCount }: { shopId: string; initialCount: number }) {
  const { t, locale } = useLocale();
  const [state, setState] = useState<{ loggedIn: boolean; following: boolean } | null>(null);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getFollowState(shopId).then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  async function toggle() {
    if (!state) return;
    const next = !state.following;
    setBusy(true);
    setError(false);
    try {
      await setFollowing(shopId, next);
      setState({ ...state, following: next });
      setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const countLabel = `${count} ${plural(count, locale, t.shop.followerOne, t.shop.followerOther)}`;
  const base = "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition disabled:opacity-60";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {state && !state.loggedIn ? (
        <Link href="/login" className={`${base} border border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white`}>
          + {t.shop.follow}
        </Link>
      ) : (
        <button
          type="button"
          onClick={toggle}
          disabled={!state || busy}
          aria-pressed={state?.following ?? false}
          title={state?.following ? t.shop.unfollowHint : t.shop.followHint}
          className={`${base} ${
            state?.following
              ? "bg-neutral-900 text-white border border-neutral-900 hover:bg-neutral-700"
              : "border border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white"
          }`}
        >
          {state?.following ? `✓ ${t.shop.following}` : `+ ${t.shop.follow}`}
        </button>
      )}
      <span className="text-xs text-neutral-500">{countLabel}</span>
      {state && !state.loggedIn && <span className="text-xs text-neutral-500 w-full">{t.shop.loginToFollow}</span>}
      {error && <span className="text-xs text-red-600 w-full">{t.shop.followError}</span>}
    </div>
  );
}
