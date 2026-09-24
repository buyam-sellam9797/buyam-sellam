"use client";

import { useState } from "react";
import { supabase, type Shop } from "@/lib/supabase";
import type { Dictionary } from "@/lib/i18n";
import { SIGNATURE_KINDS, type SignatureKind } from "@/lib/signature";
import { IconSeal, IconShield, IconCheckCircle } from "@/components/dash-icons";

// Seller side of Buyam Sellam Signature: what it is, who it's for, and
// the application (or, once approved, the story editor). Verification
// comes first: Signature sits on top of a verified shop.
export function SignaturePanel({
  shop,
  t,
  onSubmitted,
  onGoVerify,
}: {
  shop: Shop;
  t: Dictionary;
  onSubmitted: (patch: Partial<Shop>) => void;
  onGoVerify: () => void;
}) {
  const status = shop.signature_status ?? "none";
  const [kind, setKind] = useState<SignatureKind | "">(shop.signature_kind ?? "");
  const [story, setStory] = useState(shop.signature_story ?? "");
  const [founder, setFounder] = useState(shop.signature_founder ?? "");
  const [year, setYear] = useState(shop.signature_founded_year ? String(shop.signature_founded_year) : "");
  const [audience, setAudience] = useState(shop.signature_audience ?? "");
  const [proof, setProof] = useState(shop.signature_proof_url ?? shop.instagram_url ?? shop.tiktok_url ?? shop.facebook_url ?? "");
  const [made, setMade] = useState(Boolean(shop.made_in_cameroon));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const kinds = t.signature.kinds as Record<SignatureKind, string>;
  const kindHints = t.signature.kindHints as Record<SignatureKind, string>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    setBusy(true);
    const res = await fetch("/api/signature", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kind, story, founder, foundedYear: year ? Number(year) : null, audience, proofUrl: proof, madeInCameroon: made }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      const errors = t.signature.errors as Record<string, string>;
      setError((body.code && errors[body.code]) || body.error || errors.failed);
      return;
    }
    setDone(true);
    onSubmitted({
      signature_status: status === "approved" ? "approved" : "pending",
      signature_kind: kind || null,
      signature_story: story,
      signature_founder: founder || null,
      signature_founded_year: year ? Number(year) : null,
      signature_audience: audience || null,
      signature_proof_url: proof,
      made_in_cameroon: made,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl p-6 text-white" style={{ background: "var(--dash-ink)" }}>
        <p className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
          <IconSeal className="w-4 h-4" /> Buyam Sellam Signature
        </p>
        <h2 className="text-2xl font-bold mt-2 max-w-xl">{t.signature.pitchTitle}</h2>
        <p className="text-sm text-neutral-300 mt-2 max-w-xl">{t.signature.pitchBody}</p>
        <ul className="mt-4 grid sm:grid-cols-2 gap-2 text-sm">
          {t.signature.benefits.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <IconCheckCircle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" /> {b}
            </li>
          ))}
        </ul>
      </div>

      {status !== "none" && (
        <div
          className="dash-card p-4 text-sm flex items-start gap-2"
          style={
            status === "approved"
              ? { background: "var(--dash-success-wash)", color: "var(--dash-success)" }
              : status === "pending"
                ? { background: "rgba(245, 158, 11, 0.14)", color: "var(--dash-gold-ink)" }
                : { background: "var(--dash-danger-wash)", color: "var(--dash-danger)" }
          }
        >
          <IconSeal className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{(t.signature.status as Record<string, string>)[status]}</p>
            {status === "rejected" && shop.signature_note && <p className="mt-0.5">{shop.signature_note}</p>}
          </div>
        </div>
      )}

      {!shop.is_verified ? (
        <div className="dash-card p-5">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <IconShield className="w-4 h-4" /> {t.signature.verifyFirstTitle}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--dash-muted)" }}>{t.signature.verifyFirstBody}</p>
          <button type="button" onClick={onGoVerify} className="dash-btn mt-3">
            {t.signature.verifyFirstCta}
          </button>
        </div>
      ) : done ? (
        <div className="dash-card p-5 text-sm">
          <p className="font-semibold">{status === "approved" ? t.signature.updated : t.signature.submitted}</p>
          <p className="mt-1" style={{ color: "var(--dash-muted)" }}>{status === "approved" ? "" : t.signature.submittedBody}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="dash-card p-5 flex flex-col gap-4">
          <p className="text-sm font-semibold">{status === "approved" ? t.signature.editTitle : t.signature.applyTitle}</p>
          <div>
            <p className="text-xs font-medium mb-2">{t.signature.kindLabel}</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {SIGNATURE_KINDS.map((k) => (
                <label
                  key={k}
                  className="cursor-pointer rounded-xl border px-3 py-2.5"
                  style={kind === k ? { borderColor: "var(--dash-ink)", background: "var(--dash-ink)", color: "white" } : { borderColor: "var(--dash-border)" }}
                >
                  <input type="radio" name="sig-kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                  <span className="block text-sm font-semibold">{kinds[k]}</span>
                  <span className="block text-xs mt-0.5" style={{ opacity: 0.75 }}>{kindHints[k]}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="text-xs font-medium">
            {t.signature.storyLabel}
            <textarea
              value={story}
              onChange={(e) => setStory(e.target.value.slice(0, 1200))}
              rows={5}
              placeholder={t.signature.storyPlaceholder}
              className="dash-input mt-1"
            />
            <span className="block text-[11px] mt-1 text-right" style={{ color: story.trim().length < 80 ? "var(--dash-gold-ink)" : "var(--dash-muted)" }}>
              {story.trim().length}/1200 · {t.signature.storyMin}
            </span>
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs font-medium">
              {t.signature.founderLabel}
              <input value={founder} onChange={(e) => setFounder(e.target.value.slice(0, 80))} placeholder={t.signature.founderPlaceholder} className="dash-input mt-1" />
            </label>
            <label className="text-xs font-medium">
              {t.signature.yearLabel}
              <input type="number" min={1900} max={2100} value={year} onChange={(e) => setYear(e.target.value)} placeholder="2019" className="dash-input mt-1" />
            </label>
            <label className="text-xs font-medium">
              {t.signature.audienceLabel}
              <input value={audience} onChange={(e) => setAudience(e.target.value.slice(0, 120))} placeholder={t.signature.audiencePlaceholder} className="dash-input mt-1" />
            </label>
            <label className="text-xs font-medium">
              {t.signature.proofLabel}
              <input required value={proof} onChange={(e) => setProof(e.target.value)} placeholder="instagram.com/…" className="dash-input mt-1" />
            </label>
          </div>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="mt-1" checked={made} onChange={(e) => setMade(e.target.checked)} />
            <span>
              <span className="font-semibold block">{t.signature.madeLabel}</span>
              <span className="text-xs" style={{ color: "var(--dash-muted)" }}>{t.signature.madeHint}</span>
            </span>
          </label>
          {error && <p className="text-sm" style={{ color: "var(--dash-danger)" }}>{error}</p>}
          <button type="submit" disabled={busy || !kind || story.trim().length < 80 || !proof.trim()} className="dash-btn justify-center">
            {busy ? t.dashboard.saving : status === "approved" ? t.signature.saveStory : status === "pending" ? t.signature.updateApplication : t.signature.apply}
          </button>
          <p className="text-[11px]" style={{ color: "var(--dash-muted)" }}>{t.signature.reviewNote}</p>
        </form>
      )}
    </div>
  );
}
