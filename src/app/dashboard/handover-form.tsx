"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Dictionary } from "@/lib/i18n";

// Seller side of the delivery code: at handover the buyer checks the
// item and gives their 4-digit code; entering it confirms delivery
// (the order completes and the payout can be released). The seller
// never sees the code in advance — only the buyer has it.
export function HandoverForm({ orderId, t, onDone }: { orderId: string; t: Dictionary; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch(`/api/orders/${orderId}/seller`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: "handover", code }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        onDone();
        return;
      }
      if (json.error === "locked") setMessage(t.dashboard.handoverLocked);
      else if (json.error === "wrong") setMessage(t.dashboard.handoverWrong.replace("{n}", String(json.attemptsLeft ?? 0)));
      else setMessage(json.error ?? t.dashboard.handoverError);
    } catch {
      setMessage(t.dashboard.handoverError);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="dash-btn-outline !py-1.5 !px-3 text-xs mt-2">
        {t.dashboard.handoverButton}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 flex flex-col gap-2">
      <p className="text-xs" style={{ color: "var(--dash-muted)" }}>
        {t.dashboard.handoverHint}
      </p>
      <div className="flex items-center gap-2">
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder={t.dashboard.handoverPlaceholder}
          className="w-32 rounded-lg border px-3 py-1.5 text-sm font-mono tracking-widest"
          style={{ borderColor: "var(--dash-border)" }}
        />
        <button type="submit" disabled={busy || code.length !== 4} className="dash-btn !py-1.5 !px-3 text-xs disabled:opacity-50">
          {t.dashboard.handoverConfirm}
        </button>
      </div>
      {message && (
        <p className="text-xs" style={{ color: "var(--dash-danger)" }}>
          {message}
        </p>
      )}
    </form>
  );
}
