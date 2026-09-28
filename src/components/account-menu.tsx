"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useLocale } from "./locale-provider";
import { startInstall } from "./app-shell";
import {
  IconGrid,
  IconCart,
  IconHandshake,
  IconChat,
  IconBox,
  IconLink,
  IconGear,
  IconBag,
  IconHeart,
  IconLogout,
  IconBell,
  IconShield,
  IconStar,
} from "./dash-icons";

// The avatar in the top right opens this menu: who you're logged in as,
// then shortcuts to everything you use most — your shop (if you have
// one), your purchases, and your settings — so nobody has to hunt
// through the dashboard or scroll the account page to find them.
// Used in the site header and in the seller dashboard's top bar.

export type AccountMenuUser = {
  name: string | null;
  email: string | null;
  role: string | null;
  shop: { name: string; slug: string } | null;
};

type DashboardTab = "overview" | "orders" | "offers" | "messages" | "products" | "settings";

const noop = () => () => {};
const readStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function initialOf(user: AccountMenuUser): string {
  const source = user.name?.trim() || user.shop?.name?.trim() || user.email || "?";
  return source.charAt(0).toUpperCase();
}

export function AccountMenu({
  user,
  onDashboardTab,
  onSignOut,
  size = "md",
}: {
  user: AccountMenuUser;
  /** On the dashboard itself: switch tabs in place instead of navigating. */
  onDashboardTab?: (tab: DashboardTab) => void;
  onSignOut?: () => void | Promise<void>;
  size?: "sm" | "md";
}) {
  const { t, locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const standalone = useSyncExternalStore(noop, readStandalone, () => true);
  const m = t.menu;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    setOpen(false);
    if (onSignOut) {
      await onSignOut();
      return;
    }
    await supabase.auth.signOut();
    // Full reload on purpose: clears every signed-in view and cache.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }

  const close = () => setOpen(false);

  // A dashboard shortcut: in place on the dashboard, a link elsewhere.
  function dashItem(tab: DashboardTab, label: string, icon: ReactNode) {
    if (onDashboardTab) {
      return (
        <MenuButton
          icon={icon}
          label={label}
          onClick={() => {
            onDashboardTab(tab);
            close();
            window.scrollTo({ top: 0 });
          }}
        />
      );
    }
    return <MenuLink href={tab === "overview" ? "/dashboard" : `/dashboard?tab=${tab}`} icon={icon} label={label} onClick={close} />;
  }

  const dim = size === "sm" ? "w-8 h-8 text-sm" : "w-9 h-9 text-sm";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={m.open}
        className={`${dim} rounded-full bg-neutral-900 text-white font-semibold flex items-center justify-center ring-offset-2 hover:ring-2 hover:ring-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400 outline-none ${open ? "ring-2 ring-amber-400" : ""}`}
      >
        {initialOf(user)}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(18rem,calc(100vw-24px))] max-h-[calc(100vh-90px)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-xl text-sm font-normal text-neutral-800 whitespace-normal"
        >
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-3">
            <span className="w-10 h-10 shrink-0 rounded-full bg-neutral-900 text-white font-semibold flex items-center justify-center">
              {initialOf(user)}
            </span>
            <div className="min-w-0">
              <p className="font-semibold truncate">{user.name || user.shop?.name || user.email}</p>
              {user.email && <p className="text-xs text-neutral-500 truncate">{user.email}</p>}
            </div>
          </div>

          {user.role === "admin" && (
            <Group>
              <MenuLink href="/admin" icon={<IconShield className="w-4 h-4" />} label={m.admin} onClick={close} />
            </Group>
          )}

          {user.shop && (
            <Group title={m.sellerSection}>
              {dashItem("overview", m.dashboard, <IconGrid className="w-4 h-4" />)}
              {dashItem("orders", m.orders, <IconCart className="w-4 h-4" />)}
              {dashItem("offers", m.offers, <IconHandshake className="w-4 h-4" />)}
              {dashItem("messages", m.messages, <IconChat className="w-4 h-4" />)}
              {dashItem("products", m.products, <IconBox className="w-4 h-4" />)}
              <MenuLink href={`/shop/${user.shop.slug}`} icon={<IconLink className="w-4 h-4" />} label={m.viewShop} onClick={close} newTab />
              {dashItem("settings", m.shopSettings, <IconGear className="w-4 h-4" />)}
            </Group>
          )}

          <Group title={user.shop ? m.buyingSection : undefined}>
            <MenuLink href="/account#orders" icon={<IconCart className="w-4 h-4" />} label={m.myPurchases} onClick={close} />
            <MenuLink href="/account#offers" icon={<IconHandshake className="w-4 h-4" />} label={m.myOffers} onClick={close} />
            <MenuLink href="/bag" icon={<IconBag className="w-4 h-4" />} label={m.myBag} onClick={close} />
            <MenuLink href="/account#saved" icon={<IconHeart className="w-4 h-4" />} label={m.saved} onClick={close} />
            <MenuLink href="/account#following" icon={<IconStar className="w-4 h-4" />} label={m.following} onClick={close} />
            {!user.shop && <MenuLink href="/account#messages" icon={<IconChat className="w-4 h-4" />} label={m.messages} onClick={close} />}
          </Group>

          <Group>
            <MenuLink href="/account#profile" icon={<UserGlyph />} label={m.accountSettings} onClick={close} />
            <MenuLink
              href={user.shop ? "/dashboard" : "/account#notifications"}
              icon={<IconBell className="w-4 h-4" />}
              label={m.notifications}
              onClick={close}
            />
            <MenuButton
              icon={<GlobeGlyph />}
              label={m.language}
              onClick={() => {
                close();
                setLocale(locale === "fr" ? "en" : "fr");
              }}
            />
            {!standalone && (
              <MenuButton
                icon={<PhoneGlyph />}
                label={m.getApp}
                onClick={() => {
                  close();
                  startInstall();
                }}
              />
            )}
            {!user.shop && user.role !== "admin" && (
              <MenuLink href="/become-seller" icon={<IconBox className="w-4 h-4" />} label={m.openShop} onClick={close} />
            )}
          </Group>

          <div className="border-t border-neutral-100 p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-red-600 hover:bg-red-50"
            >
              <IconLogout className="w-4 h-4" />
              {m.signOut}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="border-t border-neutral-100 first:border-t-0 p-1.5">
      {title && <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{title}</p>}
      {children}
    </div>
  );
}

const itemClass = "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-neutral-100";

function MenuLink({ href, icon, label, onClick, newTab }: { href: string; icon: ReactNode; label: string; onClick: () => void; newTab?: boolean }) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className={itemClass}
      {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <span className="w-4 h-4 shrink-0 flex items-center justify-center text-neutral-500">{icon}</span>
      {label}
    </Link>
  );
}

function MenuButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={itemClass}>
      <span className="w-4 h-4 shrink-0 flex items-center justify-center text-neutral-500">{icon}</span>
      {label}
    </button>
  );
}

const glyph = { viewBox: "0 0 24 24", className: "w-4 h-4", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
function UserGlyph() {
  return (
    <svg {...glyph}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
function GlobeGlyph() {
  return (
    <svg {...glyph}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
    </svg>
  );
}
function PhoneGlyph() {
  return (
    <svg {...glyph}>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}
