"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getIdleTimeoutMinutes } from "@/lib/site-settings";
import { useLocale } from "@/components/locale-provider";

// Signs a buyer, seller or admin out after a period with no activity
// (mouse, keyboard, touch, scroll). The limit comes from the admin
// dashboard (Settings tab) — nothing here needs changing to adjust it.
//
// The time of the last activity is shared through localStorage, so
// working in one tab keeps every other open tab signed in too, and
// someone who closes the browser and comes back later than the limit
// is signed out on arrival. A minute before the limit a small banner
// offers to stay signed in.

const LAST_ACTIVITY_KEY = "bs_last_activity";
const IDLE_SIGNOUT_FLAG = "bs_idle_signout_at";
const WRITE_THROTTLE_MS = 5_000;
const CHECK_EVERY_MS = 15_000;
const WARN_BEFORE_MS = 60_000;

function readStored(key: string): number | null {
  try {
    const v = localStorage.getItem(key);
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage blocked — the in-memory timer still works for this tab.
  }
}

export function IdleLogout() {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [limitMs, setLimitMs] = useState<number | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [warning, setWarning] = useState(false);
  const lastActivity = useRef<number>(0);
  const lastWrite = useRef<number>(0);
  const signingOut = useRef(false);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const markActive = useCallback(() => {
    const now = Date.now();
    lastActivity.current = now;
    if (now - lastWrite.current > WRITE_THROTTLE_MS) {
      lastWrite.current = now;
      writeStored(LAST_ACTIVITY_KEY, now);
    }
    setWarning(false);
  }, []);

  const goToLogin = useCallback(() => {
    if (pathnameRef.current !== "/login") router.push("/login?reason=idle");
  }, [router]);

  const signOutForIdle = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    writeStored(IDLE_SIGNOUT_FLAG, Date.now());
    await supabase.auth.signOut();
    setWarning(false);
    signingOut.current = false;
    goToLogin();
  }, [goToLogin]);

  // Load the admin-set limit once per page load.
  useEffect(() => {
    let cancelled = false;
    getIdleTimeoutMinutes().then((minutes) => {
      if (!cancelled) setLimitMs(minutes > 0 ? minutes * 60_000 : 0);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Track whether anyone is signed in, and react to sign-in/out.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSignedIn(Boolean(session));
      if (event === "SIGNED_IN") {
        const now = Date.now();
        lastActivity.current = now;
        lastWrite.current = now;
        writeStored(LAST_ACTIVITY_KEY, now);
      }
      if (event === "SIGNED_OUT") {
        setWarning(false);
        // Another tab signed out for inactivity: follow it to the login
        // page with the same explanation.
        const flaggedAt = readStored(IDLE_SIGNOUT_FLAG);
        if (flaggedAt && Date.now() - flaggedAt < 30_000) goToLogin();
      }
    });
    return () => subscription.unsubscribe();
  }, [goToLogin]);

  // Watch activity and check the clock while signed in.
  useEffect(() => {
    if (!signedIn || !limitMs) return;

    // Returning after the limit (e.g. browser was closed): sign out now.
    const stored = readStored(LAST_ACTIVITY_KEY);
    if (stored && Date.now() - stored >= limitMs) {
      signOutForIdle();
      return;
    }
    const now = Date.now();
    lastActivity.current = now;
    lastWrite.current = now;
    writeStored(LAST_ACTIVITY_KEY, now);

    const events: (keyof WindowEventMap)[] = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"];
    events.forEach((ev) => window.addEventListener(ev, markActive, { passive: true }));
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    function check() {
      if (!limitMs) return;
      const shared = readStored(LAST_ACTIVITY_KEY) ?? 0;
      const last = Math.max(lastActivity.current, shared);
      const idleFor = Date.now() - last;
      if (idleFor >= limitMs) signOutForIdle();
      else setWarning(idleFor >= limitMs - Math.min(WARN_BEFORE_MS, limitMs / 2));
    }

    const timer = window.setInterval(check, CHECK_EVERY_MS);
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, markActive));
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [signedIn, limitMs, markActive, signOutForIdle]);

  if (!warning || !signedIn) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4" role="alert">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-neutral-900 text-white px-5 py-3 shadow-xl text-sm">
        <span>{t.idle.warning}</span>
        <button
          type="button"
          onClick={markActive}
          className="rounded-full bg-amber-500 text-neutral-900 font-semibold px-4 py-1.5 hover:bg-amber-400"
        >
          {t.idle.staySignedIn}
        </button>
      </div>
    </div>
  );
}
