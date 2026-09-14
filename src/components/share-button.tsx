"use client";

import { useState } from "react";
import { useLocale } from "./locale-provider";

// Uses the native share sheet on phones (where almost all traffic
// here comes from); falls back to copying the link on desktop
// browsers that don't support navigator.share.
export function ShareButton({ title, url }: { title: string; url: string }) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // Ignored — user closed the share sheet without picking anything.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — nothing more we can do silently.
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-center rounded-full border border-neutral-300 text-neutral-700 font-semibold px-6 py-3 hover:border-neutral-900"
    >
      {copied ? t.product.linkCopied : `🔗 ${t.product.share}`}
    </button>
  );
}
