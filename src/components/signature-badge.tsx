import type { Dictionary } from "@/lib/i18n";
import { IconSeal } from "./dash-icons";

// The Signature seal next to a shop's name. Only rendered for shops
// the team approved (callers check signature_status === "approved").
export function SignatureBadge({
  kind,
  madeInCameroon,
  t,
  size = "sm",
}: {
  kind: string | null;
  madeInCameroon?: boolean;
  t: Dictionary;
  size?: "sm" | "md";
}) {
  const kinds = t.signature.kinds as Record<string, string>;
  const label = kind && kinds[kind] ? kinds[kind] : null;
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-neutral-900 text-amber-300 font-semibold ${
          size === "md" ? "text-xs px-2.5 py-1" : "text-[11px] px-2 py-0.5"
        }`}
        title={label ? `${t.signature.badge} · ${label}` : t.signature.badge}
      >
        <IconSeal className={size === "md" ? "w-3.5 h-3.5" : "w-3 h-3"} />
        {t.signature.badge}
      </span>
      {madeInCameroon && (
        <span
          className={`inline-flex items-center rounded-full border border-neutral-300 text-neutral-700 font-semibold ${
            size === "md" ? "text-xs px-2.5 py-1" : "text-[11px] px-2 py-0.5"
          }`}
        >
          {t.signature.madeInCameroon}
        </span>
      )}
    </span>
  );
}
