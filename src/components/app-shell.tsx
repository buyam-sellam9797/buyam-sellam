"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "./locale-provider";
import { useBag, bagCount } from "@/lib/bag";
import { supabase, getMyShop } from "@/lib/supabase";
import { IconBag } from "./dash-icons";

// Everything that makes the site behave like an installed app:
//  - registers the service worker (fast reopen, offline screen, saved pages)
//  - "Install the app" banner: one tap on Android, step-by-step on iPhone
//  - a bottom tab bar, shown only when running as the installed app
//  - a small bar when the connection drops, and a "new version" prompt

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Shared state between the banner, the footer link and the sheet.
type PwaState = { deferred: InstallEvent | null; sheet: "none" | "ios" | "android"; views: number; dismissed: boolean };
let state: PwaState = { deferred: null, sheet: "none", views: 0, dismissed: false };
const listeners = new Set<() => void>();
function setState(patch: Partial<PwaState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const SERVER_STATE: PwaState = { deferred: null, sheet: "none", views: 0, dismissed: false };
function usePwa() {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}

const DISMISS_KEY = "bs_install_dismissed_at";
const VISITS_KEY = "bs_page_views";
const DISMISS_DAYS = 14;

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
function isIos() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}
function isIosSafari() {
  const ua = navigator.userAgent;
  // Chrome/Firefox/Edge and in-app browsers (Facebook, Instagram, TikTok)
  // on iPhone cannot add to the home screen.
  return isIos() && /safari/i.test(ua) && !/crios|fxios|edgios|fban|fbav|instagram|tiktok|line\//i.test(ua);
}
function readNumber(key: string) {
  try {
    return Number(window.localStorage.getItem(key) ?? "0") || 0;
  } catch {
    return 0;
  }
}
function writeValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode: ignore */
  }
}

const noopSubscribe = () => () => {};
function subscribeDisplayMode(cb: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}
function useStandalone() {
  return useSyncExternalStore(subscribeDisplayMode, isStandalone, () => false);
}
function useOffline() {
  return useSyncExternalStore(subscribeOnline, () => !navigator.onLine, () => false);
}
function useIosSafari() {
  return useSyncExternalStore(noopSubscribe, isIosSafari, () => false);
}

/** Opens the right install flow for this phone. Used by the banner and the footer link. */
export function startInstall() {
  if (state.deferred) {
    const ev = state.deferred;
    ev.prompt();
    ev.userChoice.finally(() => setState({ deferred: null }));
    return;
  }
  setState({ sheet: isIos() ? "ios" : "android", dismissed: true });
}

export function InstallAppLink({ className }: { className?: string }) {
  const { t } = useLocale();
  const standalone = useStandalone();
  if (standalone) return null;
  return (
    <button type="button" onClick={startInstall} className={className}>
      {t.pwa.footerLink}
    </button>
  );
}

export function AppShell() {
  const { t } = useLocale();
  const pathname = usePathname();
  const pwa = usePwa();
  const standalone = useStandalone();
  const offline = useOffline();
  const iosSafari = useIosSafari();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  // Service worker + update detection.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    // Only reload when an update the visitor asked for takes over — not
    // on the very first install, which also "changes" the controller.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          sw?.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
          });
        });
      })
      .catch(() => {});
    const onChange = () => {
      if (reloading || !hadController) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onChange);
  }, []);

  // Install prompt capture.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setState({ deferred: e as InstallEvent });
    };
    const onInstalled = () => {
      writeValue(DISMISS_KEY, String(Date.now() + 1000 * 60 * 60 * 24 * 3650));
      setState({ deferred: null, sheet: "none", dismissed: true });
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Decide whether to show the banner: not in the app already, not
  // dismissed recently, not while paying, and only once the visitor has
  // looked around a bit (3 pages) so it doesn't greet first-time visitors.
  // Count page views (to hold the banner back from first-time visitors)
  // and remember recent dismissals.
  useEffect(() => {
    const views = readNumber(VISITS_KEY) + 1;
    writeValue(VISITS_KEY, String(views));
    const dismissedAt = readNumber(DISMISS_KEY);
    setState({ views, dismissed: Boolean(dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 86400000) });
  }, [pathname]);

  // Show the banner only outside the app, not while paying or signing
  // in, after 3 pages, and only where installing actually works.
  const busy = /^\/(checkout|pay|admin|dashboard|login|signup|buyer-signup|reset-password|forgot-password)/.test(pathname);
  const banner = !standalone && !pwa.dismissed && !busy && pwa.views >= 3 && (pwa.deferred !== null || iosSafari);

  function dismiss() {
    writeValue(DISMISS_KEY, String(Date.now()));
    setState({ dismissed: true });
  }

  return (
    <>
      {offline && (
        <div className="fixed top-0 inset-x-0 z-50 bg-neutral-900 text-white text-xs text-center py-1.5 px-3" role="status">
          {t.pwa.offlineBar}
        </div>
      )}

      {waiting && (
        <div className="fixed z-50 inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] sm:bottom-6 sm:left-auto sm:right-6 sm:w-80 rounded-2xl bg-neutral-900 text-white shadow-xl p-3 flex items-center gap-3 text-sm">
          <span className="flex-1">{t.pwa.updateReady}</span>
          <button
            type="button"
            onClick={() => waiting.postMessage("skip-waiting")}
            className="rounded-lg bg-amber-500 text-neutral-900 font-semibold px-3 py-1.5"
          >
            {t.pwa.updateNow}
          </button>
        </div>
      )}

      {banner && !standalone && pwa.sheet === "none" && (
        <div className="no-print fixed z-40 inset-x-3 bottom-3 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96 rounded-2xl bg-white border border-neutral-200 shadow-xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
          <div className="flex items-start gap-3">
            <AppIconTile />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{t.pwa.bannerTitle}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{t.pwa.bannerBody}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={dismiss} className="flex-1 rounded-xl border border-neutral-200 py-2.5 text-sm font-medium">
              {t.pwa.notNow}
            </button>
            <button
              type="button"
              onClick={startInstall}
              className="flex-1 rounded-xl bg-neutral-900 text-white py-2.5 text-sm font-semibold"
            >
              {t.pwa.install}
            </button>
          </div>
        </div>
      )}

      {pwa.sheet !== "none" && <InstallSheet kind={pwa.sheet} onClose={() => setState({ sheet: "none" })} />}

      <AppTabBar />
    </>
  );
}

function AppIconTile() {
  return (
    <span aria-hidden className="w-12 h-12 shrink-0 rounded-xl bg-neutral-900 flex items-center justify-center text-lg font-extrabold tracking-tighter">
      <span className="text-white">B</span>
      <span className="text-amber-500">S</span>
    </span>
  );
}

function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 inline -mt-1" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
    </svg>
  );
}

function InstallSheet({ kind, onClose }: { kind: "ios" | "android"; onClose: () => void }) {
  const { t } = useLocale();
  const safari = useIosSafari();
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="w-full sm:w-[420px] bg-white rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <AppIconTile />
          <p className="font-semibold">{kind === "ios" ? t.pwa.iosTitle : t.pwa.androidManualTitle}</p>
        </div>
        {kind === "ios" ? (
          safari ? (
            <ol className="mt-4 space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="w-6 h-6 shrink-0 rounded-full bg-neutral-900 text-white text-xs font-bold flex items-center justify-center">1</span>
                <span>
                  {t.pwa.iosStep1} <ShareGlyph /> <span className="text-neutral-500">{t.pwa.iosStep1Hint}</span>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 shrink-0 rounded-full bg-neutral-900 text-white text-xs font-bold flex items-center justify-center">2</span>
                <span>{t.pwa.iosStep2}</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 shrink-0 rounded-full bg-neutral-900 text-white text-xs font-bold flex items-center justify-center">3</span>
                <span>{t.pwa.iosStep3}</span>
              </li>
            </ol>
          ) : (
            <p className="mt-4 text-sm text-neutral-600">{t.pwa.iosNotSafari}</p>
          )
        ) : (
          <p className="mt-4 text-sm text-neutral-600">{t.pwa.androidManualBody}</p>
        )}
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-xl bg-neutral-900 text-white py-3 text-sm font-semibold">
          {t.pwa.close}
        </button>
      </div>
    </div>
  );
}

// Bottom navigation for the installed app. Rendered always, but only
// displayed in standalone mode (CSS in globals.css), so the website in a
// normal browser tab looks exactly as before.
function AppTabBar() {
  const { t } = useLocale();
  const pathname = usePathname();
  const count = bagCount(useBag());
  const [hasShop, setHasShop] = useState(false);

  const standalone = useStandalone();
  useEffect(() => {
    if (!standalone) return;
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const shop = await getMyShop();
      if (!cancelled) setHasShop(Boolean(shop));
    });
    return () => {
      cancelled = true;
    };
  }, [standalone]);

  const tabs = [
    { href: "/", label: t.pwa.tabHome, active: pathname === "/", icon: <HomeGlyph /> },
    { href: "/browse", label: t.pwa.tabBrowse, active: pathname.startsWith("/browse") || pathname.startsWith("/category") || pathname.startsWith("/product"), icon: <SearchGlyph /> },
    { href: "/bag", label: t.pwa.tabBag, active: pathname.startsWith("/bag") || pathname.startsWith("/checkout"), icon: <IconBag className="w-6 h-6" />, badge: count },
    hasShop
      ? { href: "/dashboard", label: t.pwa.tabShop, active: pathname.startsWith("/dashboard"), icon: <ShopGlyph /> }
      : { href: "/account", label: t.pwa.tabAccount, active: pathname.startsWith("/account") || pathname.startsWith("/login"), icon: <UserGlyph /> },
  ];

  return (
    <nav className="app-tabbar no-print fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-neutral-200 pb-[env(safe-area-inset-bottom)]" aria-label="App">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${tab.active ? "text-neutral-900" : "text-neutral-400"}`}
        >
          <span className="relative">
            {tab.icon}
            {"badge" in tab && tab.badge ? (
              <span className="absolute -top-1 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-neutral-900 text-[10px] font-bold flex items-center justify-center">
                {tab.badge > 99 ? "99+" : tab.badge}
              </span>
            ) : null}
          </span>
          {tab.label}
          {tab.active && <span className="absolute top-0 inset-x-6 h-0.5 rounded-full bg-amber-500" />}
        </Link>
      ))}
    </nav>
  );
}

const glyph = { viewBox: "0 0 24 24", className: "w-6 h-6", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
function HomeGlyph() {
  return (
    <svg {...glyph}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}
function SearchGlyph() {
  return (
    <svg {...glyph}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
function UserGlyph() {
  return (
    <svg {...glyph}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
function ShopGlyph() {
  return (
    <svg {...glyph}>
      <path d="M3 9 4.5 4h15L21 9" />
      <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
      <path d="M5 11v9h14v-9" />
    </svg>
  );
}
