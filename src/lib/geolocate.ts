// One place for "use my location". Every button on the site that asks
// for the person's position goes through here, so they all behave the
// same way: a quick first attempt, one automatic second attempt with
// more time and the GPS switched on, and a clear reason when it fails
// (so the screen can say what to do instead of a vague error).

export type GeoFailure = "unsupported" | "insecure" | "denied" | "unavailable" | "timeout";

export const GEO_FAILURES: GeoFailure[] = ["unsupported", "insecure", "denied", "unavailable", "timeout"];

export class GeoError extends Error {
  reason: GeoFailure;
  constructor(reason: GeoFailure) {
    super(reason);
    this.reason = reason;
  }
}

function attempt(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options));
}

function toFailure(err: unknown): GeoFailure {
  const code = (err as GeolocationPositionError | undefined)?.code;
  if (code === 1) return "denied";
  if (code === 3) return "timeout";
  return "unavailable";
}

export async function requestLocation(): Promise<{ latitude: number; longitude: number }> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) throw new GeoError("unsupported");
  if (typeof window !== "undefined" && !window.isSecureContext) throw new GeoError("insecure");

  let position: GeolocationPosition;
  try {
    // Fast path: a recent or network-based position is fine for
    // delivery distance and "near me".
    position = await attempt({ enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 });
  } catch (first) {
    const reason = toFailure(first);
    // A refusal won't change by asking again straight away.
    if (reason === "denied") throw new GeoError("denied");
    try {
      position = await attempt({ enableHighAccuracy: true, timeout: 25000, maximumAge: 0 });
    } catch (second) {
      throw new GeoError(toFailure(second));
    }
  }
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}

// For catch blocks: the failure reason if it was a location problem,
// otherwise the error's own message.
export function geoProblem(err: unknown, fallback: string): string {
  if (err instanceof GeoError) return err.reason;
  return err instanceof Error ? err.message : fallback;
}
