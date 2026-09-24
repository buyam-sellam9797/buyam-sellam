"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";

type Application = {
  id: string;
  shop_name: string;
  slug: string;
  city: string;
  is_verified: boolean;
  signature_status: "pending" | "approved" | "rejected";
  signature_kind: string | null;
  signature_story: string | null;
  signature_founder: string | null;
  signature_founded_year: number | null;
  signature_audience: string | null;
  signature_proof_url: string | null;
  made_in_cameroon: boolean;
  signature_applied_at: string | null;
  signature_note: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
};

// Admin review of Signature applications: read the story, open the
// proof link and socials, then approve or decline with a note the shop
// receives by email.
export function SignatureTab({ token, t, setAuthError }: { token: string; t: Dictionary; setAuthError: (e: string | null) => void }) {
  const [apps, setApps] = useState<Application[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const kinds = t.signature.kinds as Record<string, string>;

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/signature", { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (!res.ok) {
      setAuthError(json.error ?? t.admin.notAuthorized);
      return;
    }
    setApps(json.shops);
  }, [token, setAuthError, t.admin.notAuthorized]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function decide(shopId: string, decision: "approved" | "rejected" | "none") {
    setBusy(shopId);
    await fetch("/api/admin/signature", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ shopId, decision, note: notes[shopId] }),
    });
    await load();
    setBusy(null);
  }

  if (!apps) return <p className="text-sm text-neutral-500">{t.admin.loading}</p>;
  if (apps.length === 0) return <p className="text-sm text-neutral-500">{t.signature.adminEmpty}</p>;

  const order = { pending: 0, approved: 1, rejected: 2 } as const;
  return (
    <div className="flex flex-col gap-4">
      {[...apps]
        .sort((a, b) => order[a.signature_status] - order[b.signature_status])
        .map((a) => (
          <div
            key={a.id}
            className={`rounded-xl border p-4 ${a.signature_status === "pending" ? "border-amber-300 bg-amber-50" : "border-neutral-200 bg-white"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/shop/${a.slug}`} target="_blank" className="font-semibold hover:underline">
                {a.shop_name} <span className="text-neutral-500 font-normal">· {a.city}</span>
              </Link>
              <span className="text-xs font-semibold rounded-full bg-white border border-neutral-200 px-2.5 py-0.5">
                {(t.signature.status as Record<string, string>)[a.signature_status]}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              {a.signature_kind ? kinds[a.signature_kind] : "—"}
              {a.signature_founder && ` · ${a.signature_founder}`}
              {a.signature_founded_year && ` · ${a.signature_founded_year}`}
              {a.signature_audience && ` · ${a.signature_audience}`}
              {a.made_in_cameroon && ` · ${t.signature.madeInCameroon}`}
              {!a.is_verified && ` · ⚠ ${t.signature.adminNotVerified}`}
            </p>
            {a.signature_story && <p className="text-sm mt-2 whitespace-pre-line">{a.signature_story}</p>}
            <div className="flex flex-wrap gap-3 mt-2 text-xs">
              {[a.signature_proof_url, a.instagram_url, a.tiktok_url, a.facebook_url]
                .filter((u): u is string => Boolean(u))
                .filter((u, i, arr) => arr.indexOf(u) === i)
                .map((u) => (
                  <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="underline text-amber-800 break-all">
                    {u.replace(/^https?:\/\//, "")}
                  </a>
                ))}
            </div>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <input
                value={notes[a.id] ?? a.signature_note ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [a.id]: e.target.value }))}
                placeholder={t.signature.adminNotePlaceholder}
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
              />
              {a.signature_status !== "approved" && (
                <button type="button" disabled={busy === a.id} onClick={() => decide(a.id, "approved")} className="rounded-full bg-neutral-900 text-white text-sm font-semibold px-4 py-1.5 disabled:opacity-50">
                  {t.signature.adminApprove}
                </button>
              )}
              {a.signature_status !== "rejected" && (
                <button type="button" disabled={busy === a.id} onClick={() => decide(a.id, "rejected")} className="rounded-full border border-neutral-300 text-sm font-semibold px-4 py-1.5 disabled:opacity-50">
                  {a.signature_status === "approved" ? t.signature.adminRemove : t.signature.adminReject}
                </button>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}
