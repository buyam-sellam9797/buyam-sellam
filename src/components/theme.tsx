"use client";

import { useSyncExternalStore } from "react";
import { useLocale } from "./locale-provider";

// Light / dark / automatic (follow the phone or computer setting).
// The choice lives in this browser only. The small script in the
// layout's <head> applies it before the first paint, so pages never
// flash white before turning dark.

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "theme";
const EVENT = "bs-theme";

/** Runs in <head> before anything renders. Keep in sync with applyTheme(). */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${KEY}")||"light";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.dataset.theme="dark";var m=document.querySelector('meta[name="theme-color"]');if(m)m.content="#0d0d0e"}}catch(e){}})()`;

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && prefersDark());
  const root = document.documentElement;
  if (dark) root.dataset.theme = "dark";
  else delete root.dataset.theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", dark ? "#0d0d0e" : "#ffffff"));
}

export function setTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // Private mode: still switch for this page view.
  }
  applyTheme(choice);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (readChoice() === "system") applyTheme("system");
    onChange();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      applyTheme(readChoice());
      onChange();
    }
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", onSystem);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", onSystem);
  };
}

export function useTheme(): ThemeChoice {
  return useSyncExternalStore(subscribe, readChoice, () => "light" as ThemeChoice);
}

const OPTIONS: ThemeChoice[] = ["light", "dark", "system"];

/** Three-way switch: Light · Dark · Auto. */
export function ThemeSwitch({ className = "" }: { className?: string }) {
  const { t } = useLocale();
  const choice = useTheme();
  const label = { light: t.menu.themeLight, dark: t.menu.themeDark, system: t.menu.themeAuto };
  return (
    <div role="radiogroup" aria-label={t.menu.appearance} className={`inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 ${className}`}>
      {OPTIONS.map((opt) => {
        const active = choice === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(opt)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${active ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
          >
            <ThemeGlyph kind={opt} />
            {label[opt]}
          </button>
        );
      })}
    </div>
  );
}

function ThemeGlyph({ kind }: { kind: ThemeChoice }) {
  const common = { viewBox: "0 0 24 24", className: "w-3.5 h-3.5", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (kind === "light")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  if (kind === "dark")
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}
