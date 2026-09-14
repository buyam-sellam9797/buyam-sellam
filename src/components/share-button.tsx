"use client";

import { useState } from "react";
import { useLocale } from "./locale-provider";

// A small explicit share menu (WhatsApp / Facebook / copy link) rather
// than relying only on navigator.share — that native sheet doesn't
// exist on desktop browsers at all, and WhatsApp is specifically where
// sellers here actually get traction, so it deserves its own button
// rather than being buried inside an OS share sheet.
export function ShareButton({
  title,
  url,
  message,
}: {
  title: string;
  url: string;
  /** Pre-filled text for chat shares (WhatsApp). Falls back to just the title. */
  message?: string;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareText = message ?? title;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`;
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — nothing more we can do silently.
    }
  }

  async function handleToggle() {
    // On phones with a native share sheet, prefer that — it already
    // includes WhatsApp, Facebook, Messenger, SMS, everything installed.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url });
      } catch {
        // User closed the share sheet without picking anything.
      }
      return;
    }
    setOpen((o) => !o);
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex w-full items-center justify-center gap-1.5 text-center rounded-full border border-neutral-300 text-neutral-700 font-semibold px-6 py-3 hover:border-neutral-900"
      >
        🔗 {t.product.share}
      </button>
      {open && (
        <div className="mt-2 flex gap-2">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center rounded-full border border-green-600 text-green-700 text-sm font-medium px-3 py-2 hover:bg-green-50"
          >
            WhatsApp
          </a>
          <a
            href={facebookHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center rounded-full border border-blue-600 text-blue-700 text-sm font-medium px-3 py-2 hover:bg-blue-50"
          >
            Facebook
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 text-center rounded-full border border-neutral-300 text-neutral-700 text-sm font-medium px-3 py-2 hover:border-neutral-900"
          >
            {copied ? t.product.linkCopied : t.product.copyLink}
          </button>
        </div>
      )}
    </div>
  );
}
