"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconPin } from "@/components/dash-icons";
import { requestLocation, geoProblem } from "@/lib/geolocate";
import { LocationProblem } from "@/components/location-problem";

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

  async function handleClick() {
    setLocating(true);
    setError(null);
    try {
      const pos = await requestLocation();
      const params = new URLSearchParams(searchParams.toString());
      params.set("lat", String(pos.latitude));
      params.set("lng", String(pos.longitude));
      params.set("sort", "nearest");
      router.push(`/browse?${params.toString()}`);
    } catch (err) {
      setError(geoProblem(err, t.locationDenied));
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="mb-4 flex flex-col items-start gap-1">
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
      {error && <LocationProblem problem={error} onRetry={handleClick} retrying={locating} className="max-w-md" />}
    </div>
  );
}
