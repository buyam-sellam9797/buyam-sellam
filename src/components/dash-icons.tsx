// A small set of monochrome, single-weight line icons for the seller
// dashboard, replacing the colorful platform emoji that used to sit in
// the sidebar, stat cards, and alert banners. Emoji render as tiny
// full-color pictures whose colors have nothing to do with the site's
// own black/white/amber palette and look different on every device —
// exactly the "multi colour drawings" look the shop owner asked us to
// move away from. These icons instead inherit `currentColor`, so they
// always match whatever text color surrounds them (muted gray, amber
// ink, success green, danger red, or plain ink) and stay crisp at any
// size, on any platform.
//
// Kept intentionally small and dependency-free (no icon package) —
// just the handful of glyphs this dashboard actually uses.

import type { ReactNode, SVGProps } from "react";

// `title` isn't part of React's SVGProps, so it's declared separately
// here and rendered as a real <title> child — that also gives the icon
// an accessible name for free, instead of relying on a bare DOM
// attribute the way the "title=" tooltip trick worked on the old emoji.
type IconProps = SVGProps<SVGSVGElement> & { className?: string; title?: string };

function Base({ children, className, title, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "w-4 h-4"}
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
      {...rest}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export function IconGrid(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </Base>
  );
}

export function IconCart(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="9.5" cy="20" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="18" cy="20" r="1.25" fill="currentColor" stroke="none" />
      <path d="M2.5 3.5h2.4l2.1 11.4a1.8 1.8 0 0 0 1.78 1.5h8.7a1.8 1.8 0 0 0 1.77-1.47L21 7.5H6" />
    </Base>
  );
}

export function IconBox(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3.5 7.5 12 3l8.5 4.5-8.5 4.5-8.5-4.5Z" />
      <path d="M3.5 7.5v9L12 21l8.5-4.5v-9" />
      <path d="M12 12v9" />
    </Base>
  );
}

export function IconGear(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.1 5.9l-1.55 1.55M7.45 16.55 5.9 18.1M18.1 18.1l-1.55-1.55M7.45 7.45 5.9 5.9" />
    </Base>
  );
}

export function IconTruck(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M2.5 6.5h11v9h-11z" />
      <path d="M13.5 10h3.6l3.4 3v2.5h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </Base>
  );
}

export function IconShield(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.2 19 6v5.4c0 4.4-3 7.9-7 9.4-4-1.5-7-5-7-9.4V6l7-2.8Z" />
      <path d="m9.2 12 1.9 1.9 3.7-3.9" />
    </Base>
  );
}

export function IconCard(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 10h19" />
      <path d="M6 14.5h4" />
    </Base>
  );
}

export function IconStar({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Base {...props} fill={filled ? "currentColor" : "none"}>
      <path d="m12 3.5 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85L12 3.5Z" />
    </Base>
  );
}

export function IconHeart({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Base {...props} fill={filled ? "currentColor" : "none"}>
      <path d="M12 20.2s-7.5-4.6-9.8-9.1C.7 7.7 2.3 4.5 5.5 3.7c2-.5 4 .3 5.2 2 .3.4.9.4 1.2 0 1.2-1.7 3.2-2.5 5.2-2 3.2.8 4.8 4 3.3 7.4-2.3 4.5-9.4 9.1-9.4 9.1Z" />
    </Base>
  );
}

export function IconTrendingUp(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 17 9.5 10.5 13.5 14.5 21 6.5" />
      <path d="M15 6.5h6v6" />
    </Base>
  );
}

export function IconTrendingDown(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 7 9.5 13.5 13.5 9.5 21 17.5" />
      <path d="M15 17.5h6v-6" />
    </Base>
  );
}

export function IconLink(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M11 6.3 12.9 4.4a3.6 3.6 0 0 1 5 5L16 11.4" />
      <path d="M13 17.7 11.1 19.6a3.6 3.6 0 0 1-5-5L8 12.6" />
    </Base>
  );
}

export function IconLogout(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9.5 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h3.5" />
      <path d="M14.5 8.5 19 12l-4.5 3.5" />
      <path d="M19 12H9.5" />
    </Base>
  );
}

export function IconMegaphone(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3.5 10v4a1.2 1.2 0 0 0 1.2 1.2h1.1l1.9 4.3 1.5-.6-1.6-3.7 8.9 2.9V6.9L6.7 9.8H4.7A1.2 1.2 0 0 0 3.5 10Z" />
      <path d="M20.5 10.2a3 3 0 0 1 0 4.6" />
    </Base>
  );
}

export function IconAlertTriangle(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 4 21.5 20H2.5L12 4Z" />
      <path d="M12 10.2v4" />
      <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconLock(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="10.5" width="14" height="9" rx="1.8" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </Base>
  );
}

export function IconCheckCircle(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.3 12.3 2.5 2.5 5-5.2" />
    </Base>
  );
}

export function IconEye(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Base>
  );
}

export function IconBag(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6.5 8.5h11l1 12h-13z" />
      <path d="M9 8.5V6.8a3 3 0 0 1 6 0v1.7" />
    </Base>
  );
}

export function IconPin(props: IconProps) {
  return (
    <Base {...props} fill="currentColor" strokeWidth={0}>
      <path d="M12 2.5a5 5 0 0 0-5 5c0 3.6 5 12.5 5 12.5s5-8.9 5-12.5a5 5 0 0 0-5-5Zm0 6.8a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6Z" />
    </Base>
  );
}

export function IconBell(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 10.5a6 6 0 0 1 12 0c0 4 1.4 5.6 1.4 5.6H4.6S6 14.5 6 10.5Z" />
      <path d="M10.2 19.5a1.9 1.9 0 0 0 3.6 0" />
    </Base>
  );
}

export function IconBanknote(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="2.5" y="6.5" width="19" height="11" rx="1.8" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M5.5 9v0M18.5 15v0" />
    </Base>
  );
}

export function IconCalculator(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="2.5" width="14" height="19" rx="2" />
      <path d="M8 6.5h8" />
      <path d="M8 11h0M12 11h0M16 11h0M8 14.5h0M12 14.5h0M16 14.5h0M8 18h0M12 18h0M16 18h0" strokeWidth={2.4} />
    </Base>
  );
}

export function IconRepeat(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4.5 12a7.5 7.5 0 0 1 12.4-5.7L19 8" />
      <path d="M19 4v4h-4" />
      <path d="M19.5 12a7.5 7.5 0 0 1-12.4 5.7L5 16" />
      <path d="M5 20v-4h4" />
    </Base>
  );
}

export function IconChat(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3.5 5.5h17v11h-9.2L7 20v-3.5H3.5Z" />
    </Base>
  );
}

export function IconAward(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="8.5" r="5" />
      <path d="m8.7 12.8-1.4 7.7 4.7-2.6 4.7 2.6-1.4-7.7" />
    </Base>
  );
}

export function IconTag(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12.6 3.5h6.4a1.5 1.5 0 0 1 1.5 1.5v6.4a1.5 1.5 0 0 1-.44 1.06l-8.4 8.4a1.5 1.5 0 0 1-2.12 0l-6.4-6.4a1.5 1.5 0 0 1 0-2.12l8.4-8.4a1.5 1.5 0 0 1 1.06-.44Z" />
      <circle cx="16.75" cy="7.25" r="1.25" fill="currentColor" stroke="none" />
    </Base>
  );
}

// Signature shops: a scalloped seal with a check.
export function IconSeal(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 2.8l2.05 1.5 2.52-.2.83 2.39 2.2 1.25-.55 2.47 1.15 2.26-1.9 1.67-.36 2.5-2.5.46-1.53 2.02L12 17.9l-2.38 1.2-1.53-2.02-2.5-.46-.36-2.5-1.9-1.67 1.15-2.26-.55-2.47 2.2-1.25.83-2.39 2.52.2Z" />
      <path d="m9 10.8 2.1 2.1 4-4" />
    </Base>
  );
}

// Offers / negotiation.
export function IconHandshake(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m11 17 2 2a1.4 1.4 0 0 0 2-2" />
      <path d="m14 14 2.5 2.5a1.4 1.4 0 0 0 2-2l-3.9-3.9a2.4 2.4 0 0 0-3.4 0l-.9.9a1.4 1.4 0 0 1-2-2l2.8-2.8a4.9 4.9 0 0 1 6 -.7l.5.3a3.3 3.3 0 0 0 1.9.4H21" />
      <path d="M21 14.5V6.5" />
      <path d="M3 6.5h2l6 6" />
      <path d="M3 14.5 8 19.5a1.4 1.4 0 0 0 2-2" />
      <path d="M3 6.5v8" />
    </Base>
  );
}

// Shop books (sales, stock, expenses).
export function IconBook(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15.5H6.5A1.5 1.5 0 0 0 5 20Z" />
      <path d="M5 20a1.5 1.5 0 0 0 1.5 1.5H19V18.5" />
      <path d="M9 7.5h6M9 11h4" />
    </Base>
  );
}

export function IconPrinter(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 8V3.5h10V8" />
      <rect x="3.5" y="8" width="17" height="8" rx="1.5" />
      <path d="M7 13.5h10v7H7Z" />
    </Base>
  );
}

export function IconClock(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Base>
  );
}

export function IconGift(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="8" width="17" height="4" rx="1" />
      <path d="M5 12v8.5h14V12M12 8v12.5" />
      <path d="M12 8c-1.5-3.5-5.5-3.5-5.5-1S10 8 12 8Zm0 0c1.5-3.5 5.5-3.5 5.5-1S14 8 12 8Z" />
    </Base>
  );
}

/**
 * A small solid-color status dot — replaces the platform-dependent
 * 🟢🟡🔴 emoji everywhere the dashboard needs to show a red/amber/green
 * status at a glance (verification state, open/closed, todo severity).
 * Colors come straight from the site's own tokens, so it always matches
 * the rest of the brand instead of an emoji's fixed, uncoordinated hue.
 */
export function StatusDot({
  tone,
  className,
}: {
  tone: "success" | "warning" | "danger" | "neutral";
  className?: string;
}) {
  const color =
    tone === "success"
      ? "var(--dash-success)"
      : tone === "warning"
        ? "var(--dash-gold)"
        : tone === "danger"
          ? "var(--dash-danger)"
          : "var(--dash-muted)";
  return (
    <span
      aria-hidden="true"
      className={className ?? "inline-block w-2 h-2 rounded-full shrink-0"}
      style={{ background: color }}
    />
  );
}
