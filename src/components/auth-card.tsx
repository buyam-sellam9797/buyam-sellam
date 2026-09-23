"use client";

import { useState, type ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { IconLock, IconBanknote, IconChat, IconShield } from "@/components/dash-icons";

// Shared look for the login and sign-up screens: a single centred card
// floating on a soft, lightly tinted background, with a small brand
// tile, a title and a one-line subtitle on top. Colours are the site's
// own (neutral-900 ink, amber accent), not the reference design's.

// On wider screens the card gains a dark brand panel on the left: the
// Buyam Sellam wordmark, one headline and the three promises that make
// the marketplace different (money held safely until delivery, verified
// sellers, WhatsApp built in). On phones that panel is dropped so the
// form is the first and only thing on screen.
export function AuthShell({
  icon,
  title,
  subtitle,
  panelHeadline,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  panelHeadline: string;
  children: ReactNode;
}) {
  const { t } = useLocale();
  return (
    <div
      className="flex justify-center px-4 py-8 sm:py-14"
      style={{
        background:
          "radial-gradient(900px 480px at 10% -10%, rgba(23,23,23,0.06), rgba(0,0,0,0) 60%), radial-gradient(800px 420px at 95% 0%, rgba(245,158,11,0.16), rgba(0,0,0,0) 60%), linear-gradient(#fafafa, #f5f5f4)",
        minHeight: "calc(100dvh - 60px)",
      }}
    >
      <div
        className="w-full max-w-md md:max-w-4xl self-start rounded-3xl border border-neutral-200 bg-white overflow-hidden md:grid md:grid-cols-[5fr_6fr]"
        style={{ boxShadow: "0 24px 60px rgba(23,23,23,0.10)" }}
      >
        <aside
          className="hidden md:flex flex-col justify-between p-10 text-white relative overflow-hidden"
          style={{
            background:
              "radial-gradient(520px 320px at 110% 110%, rgba(245,158,11,0.35), rgba(0,0,0,0) 60%), linear-gradient(160deg, #171717 0%, #262626 100%)",
          }}
        >
          <p className="text-xl font-bold tracking-tight">
            Buyam<span className="text-amber-400">Sellam</span>
          </p>
          <div>
            <p className="text-3xl font-bold leading-tight mb-8">{panelHeadline}</p>
            <ul className="space-y-4 text-sm text-neutral-300">
              <li className="flex gap-3">
                <span className="mt-0.5 w-7 h-7 shrink-0 rounded-lg bg-white/10 flex items-center justify-center text-amber-400">
                  <IconBanknote className="w-4 h-4" />
                </span>
                <span>{t.auth.panelPoint1}</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 w-7 h-7 shrink-0 rounded-lg bg-white/10 flex items-center justify-center text-amber-400">
                  <IconShield className="w-4 h-4" />
                </span>
                <span>{t.auth.panelPoint2}</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 w-7 h-7 shrink-0 rounded-lg bg-white/10 flex items-center justify-center text-amber-400">
                  <IconChat className="w-4 h-4" />
                </span>
                <span>{t.auth.panelPoint3}</span>
              </li>
            </ul>
          </div>
          <p className="text-xs text-neutral-400">{t.auth.panelFooter}</p>
        </aside>

        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-amber-400 flex items-center justify-center mb-4">
              {icon}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-neutral-500 mt-1.5">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition focus:border-neutral-900 focus:bg-white focus:ring-2 focus:ring-neutral-900/10";

export function AuthField({
  id,
  label,
  hint,
  ...inputProps
}: {
  id: string;
  label: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold mb-2">
        {label}
      </label>
      <input id={id} {...inputProps} className={inputClass} />
      {hint && <p className="text-xs text-neutral-500 mt-1.5">{hint}</p>}
    </div>
  );
}

export function AuthSelect({
  id,
  label,
  options,
  ...selectProps
}: {
  id: string;
  label: string;
  options: { value: string; label: string }[];
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold mb-2">
        {label}
      </label>
      <select id={id} {...selectProps} className={inputClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  hint,
  autoComplete,
  labelAside,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  autoComplete: string;
  labelAside?: ReactNode;
}) {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label htmlFor={id} className="block text-sm font-semibold">
          {label}
        </label>
        {labelAside}
      </div>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} pr-12`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t.auth.hidePassword : t.auth.showPassword}
          title={visible ? t.auth.hidePassword : t.auth.showPassword}
          className="absolute inset-y-0 right-0 px-4 flex items-center text-neutral-400 hover:text-neutral-900"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint && <p className="text-xs text-neutral-500 mt-1.5">{hint}</p>}
    </div>
  );
}

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{children}</p>
  );
}

export function AuthNotice({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">{children}</p>
  );
}

export function AuthSubmit({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-xl bg-neutral-900 text-white font-semibold px-6 py-3.5 flex items-center justify-center gap-2 hover:bg-neutral-700 disabled:opacity-60 transition"
    >
      {children}
    </button>
  );
}

export function TrustFooter() {
  const { t } = useLocale();
  return (
    <div className="mt-8 pt-5 border-t border-neutral-200 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-neutral-500">
      <span className="inline-flex items-center gap-1.5">
        <IconLock className="w-3.5 h-3.5" /> {t.auth.trustSecure}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <IconBanknote className="w-3.5 h-3.5" /> {t.auth.trustMobileMoney}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <IconChat className="w-3.5 h-3.5" /> {t.auth.trustWhatsapp}
      </span>
    </div>
  );
}

// Small line icons local to the auth screens, drawn in the same style as
// the ones in dash-icons (24px grid, 1.75 stroke, currentColor).
function svgProps(className?: string) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: className ?? "w-5 h-5",
    "aria-hidden": true,
  };
}

export function EyeIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2" />
      <path d="M6.6 6.6C3.9 8.3 2 12 2 12s3.5 7 10 7a10.6 10.6 0 0 0 5.4-1.5" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export function LogInIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}

export function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </svg>
  );
}
