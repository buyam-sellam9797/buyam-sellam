"use client";

import { supabase } from "@/lib/supabase";

// Every "Sign out" goes through here, so nothing of the previous person
// stays behind on a shared phone or computer:
//  - this device stops receiving their order/offer notifications
//    (the server forgets the device, then the browser unsubscribes);
//  - the session ends;
//  - the page is fully reloaded, clearing every signed-in view.
export async function signOutEverywhere(destination = "/"): Promise<void> {
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch {
    // Never let notification cleanup block signing out.
  }
  await supabase.auth.signOut().catch(() => {});
  try {
    localStorage.removeItem("bs_last_activity");
  } catch {
    // storage blocked
  }
  // Full reload on purpose: clears every signed-in view and cache.
  window.location.assign(destination);
}
