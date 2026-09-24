"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "./locale-provider";
import { startInstall } from "./app-shell";
import { IconBell } from "./dash-icons";

// Turn phone notifications on/off for this device (orders, offers,
// payments). Shown on the seller dashboard, the buyer's account page,
// and as a one-time nudge inside the installed app.

type Support = "server" | "ok" | "ios-install" | "unsupported";

function readSupport(): Support {
  const hasApi = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // iPhone only allows web push for apps added to the home screen.
  if (ios && !standalone) return "ios-install";
  return hasApi ? "ok" : "unsupported";
}
const noop = () => () => {};
function useSupport(): Support {
  return useSyncExternalStore(noop, readSupport, () => "server" as Support);
}

async function authHeader(): Promise<Record<string, string> | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function enablePush(locale: string): Promise<"on" | "denied" | "failed"> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "failed";
  const auth = await authHeader();
  if (!auth) return "failed";
  try {
    const keyRes = await fetch("/api/push/key");
    if (!keyRes.ok) return "failed";
    const { publicKey } = (await keyRes.json()) as { publicKey: string };
    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey }));
    const json = sub.toJSON();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, locale }),
    });
    return res.ok ? "on" : "failed";
  } catch {
    return "failed";
  }
}

export function PushToggle({ audience, className = "" }: { audience: "seller" | "buyer"; className?: string }) {
  const { t, locale } = useLocale();
  const support = useSupport();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (support !== "ok") return;
    let cancelled = false;
    currentSubscription().then((sub) => {
      if (cancelled) return;
      setOn(Boolean(sub) && Notification.permission === "granted");
      setBlocked(Notification.permission === "denied");
    });
    return () => {
      cancelled = true;
    };
  }, [support]);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    const result = await enablePush(locale);
    setBusy(false);
    if (result === "on") setOn(true);
    else if (result === "denied") setBlocked(true);
    else setMessage(t.push.failed);
  }

  async function turnOff() {
    setBusy(true);
    const sub = await currentSubscription();
    const auth = await authHeader();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(auth ?? {}) },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    setBusy(false);
    setOn(false);
    setMessage(null);
  }

  async function sendTest() {
    const auth = await authHeader();
    if (!auth) return;
    setBusy(true);
    await fetch(`/api/push/test?lang=${locale}`, { method: "POST", headers: auth }).catch(() => {});
    setBusy(false);
    setMessage(t.push.testSent);
  }

  if (support === "server") return null;

  return (
    <div className={`rounded-2xl border border-neutral-200 bg-white p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 shrink-0 rounded-xl bg-neutral-900 text-amber-400 flex items-center justify-center">
          <IconBell className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{t.push.title}</p>
          <p className="text-xs text-neutral-500 mt-0.5">{audience === "seller" ? t.push.sellerBody : t.push.buyerBody}</p>

          {support === "unsupported" && <p className="text-xs text-neutral-600 mt-2">{t.push.unsupported}</p>}

          {support === "ios-install" && (
            <>
              <p className="text-xs text-neutral-600 mt-2">{t.push.iosInstall}</p>
              <button type="button" onClick={startInstall} className="mt-3 rounded-xl bg-neutral-900 text-white text-sm font-semibold px-4 py-2">
                {t.push.installFirst}
              </button>
            </>
          )}

          {support === "ok" && blocked && !on && <p className="text-xs text-neutral-600 mt-2">{t.push.denied}</p>}

          {support === "ok" && !blocked && on === false && (
            <button type="button" disabled={busy} onClick={turnOn} className="mt-3 rounded-xl bg-neutral-900 text-white text-sm font-semibold px-4 py-2 disabled:opacity-50">
              {t.push.turnOn}
            </button>
          )}

          {support === "ok" && on && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-xs font-semibold">● {t.push.on}</span>
              <button type="button" disabled={busy} onClick={sendTest} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium disabled:opacity-50">
                {t.push.sendTest}
              </button>
              <button type="button" disabled={busy} onClick={turnOff} className="text-xs text-neutral-500 underline underline-offset-2 disabled:opacity-50">
                {t.push.turnOff}
              </button>
            </div>
          )}

          {message && <p className="text-xs text-neutral-600 mt-2">{message}</p>}
        </div>
      </div>
    </div>
  );
}
