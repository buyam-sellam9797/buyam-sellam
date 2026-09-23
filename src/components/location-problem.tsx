"use client";

import { useLocale } from "@/components/locale-provider";
import { GEO_FAILURES, type GeoFailure } from "@/lib/geolocate";

// What to show when "use my location" fails: the reason in plain words,
// what to do about it, and a Try again button. `problem` is either a
// failure reason from requestLocation() or any other message (e.g. the
// position was found but saving it failed), which is shown as is.
export function LocationProblem({
  problem,
  onRetry,
  retrying = false,
  optional = false,
  className = "",
}: {
  problem: string;
  onRetry: () => void;
  retrying?: boolean;
  optional?: boolean;
  className?: string;
}) {
  const { t } = useLocale();
  const reason = (GEO_FAILURES as string[]).includes(problem) ? (problem as GeoFailure) : null;
  const message = reason ? t.geo[reason] : problem;
  const canRetry = reason !== "unsupported" && reason !== "insecure";

  return (
    <div className={`mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800 ${className}`} role="alert">
      <p className="font-semibold">{message}</p>
      {reason === "denied" && (
        <ul className="mt-1.5 list-disc pl-4 space-y-0.5 text-red-700">
          <li>{t.geo.deniedComputer}</li>
          <li>{t.geo.deniedPhone}</li>
        </ul>
      )}
      {(reason === "unavailable" || reason === "timeout") && <p className="mt-1 text-red-700">{t.geo.unavailableHow}</p>}
      {optional && <p className="mt-1 text-red-700">{t.geo.optional}</p>}
      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-2 rounded-full border border-red-300 bg-white px-3 py-1 font-semibold text-red-800 hover:border-red-600 disabled:opacity-60"
        >
          {retrying ? t.geo.retrying : t.geo.tryAgain}
        </button>
      )}
    </div>
  );
}
