"use client";

import { useState } from "react";
import { supabase, requestRestockNotification } from "@/lib/supabase";
import { useLocale } from "./locale-provider";
import { IconChat } from "./dash-icons";

// "Notify me when back in stock" for an out-of-stock product. Unlike
// favorites, this deliberately works for guests too — most Buyam
// Sellam checkouts are guest checkouts, and a low-commitment action
// like this shouldn't require creating an account first. Signed-in
// buyers and guests who leave an email get an automatic email when the
// seller restocks; guests who only leave a phone number stay on the
// seller's dashboard list to be contacted on WhatsApp.
export function RestockNotifyButton({ productId, shopId }: { productId: string; shopId: string }) {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");

  async function handleOpen() {
    setOpen(true);
    if (loggedIn === null) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setLoggedIn(Boolean(session));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    try {
      await requestRestockNotification({ productId, shopId, contactPhone: phone, contactEmail: email, locale });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-full border border-neutral-300 text-neutral-700 font-semibold px-6 py-3 hover:border-neutral-900"
      >
        <IconChat className="w-4 h-4" />
        {t.product.notifyWhenAvailable}
      </button>
    );
  }

  if (status === "done") {
    return (
      <p className="mt-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center">
        {t.product.notifySuccess}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-sm font-semibold mb-1">{t.product.notifyModalTitle}</p>
      {loggedIn ? (
        <p className="text-xs text-neutral-500 mb-3">{t.product.notifyModalBody}</p>
      ) : (
        <>
          <p className="text-xs text-neutral-500 mb-2">{t.product.notifyGuestBody}</p>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.product.notifyEmailPlaceholder}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm mb-2"
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.product.notifyPhonePlaceholder}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm mb-3"
          />
        </>
      )}
      {status === "error" && (
        <p className="text-xs text-red-600 mb-2">{t.product.notifyError}</p>
      )}
      <button
        type="submit"
        disabled={status === "submitting" || (!loggedIn && !phone.trim() && !email.trim())}
        className="w-full rounded-full bg-neutral-900 text-white font-semibold px-6 py-2.5 text-sm hover:bg-neutral-700 disabled:opacity-60"
      >
        {status === "submitting" ? t.product.notifySubmitting : t.product.notifySubmit}
      </button>
    </form>
  );
}
