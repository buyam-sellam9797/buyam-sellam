"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconPin } from "@/components/dash-icons";

// A small client "island" inside the otherwise server-rendered browse
// page. Browser geolocation can't be requested from a plain GET form,
// so this button gets the buyer's coordinates itself, then redirects
// to the same browse URL with lat/lng and sort=nearest added — the
// server component does the actual distance sort from there.
export default function NearMeButton({ t }: { t: { nearMe: string; locating: string; locationDenied: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = searchParams.get("sort") === "nearest" && searchParams.get("lat");

  function handleClick() {
    if (!navigator.geolocation) {
      setError(t.locationDenied);
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("lat", String(pos.coords.latitude));
        params.set("lng", String(pos.coords.longitude));
        params.set("sort", "nearest");
        setLocating(false);
        router.push(`/browse?${params.toString()}`);
      },
      () => {
        setError(t.locationDenied);
        setLocating(false);
      },
      { timeout: 10000 }
    );
  }

  return (
    <div className="mb-4 flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={locating}
        className={`text-sm rounded-full px-4 py-1.5 border disabled:opacity-60 inline-flex items-center gap-1 ${
          isActive
            ? "bg-neutral-900 text-white border-neutral-900"
            : "border-neutral-300 hover:border-neutral-900"
        }`}
      >
        {locating ? t.locating : (
          <>
            <IconPin className="w-3.5 h-3.5" /> {t.nearMe}
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
