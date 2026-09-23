"use client";

import { useState, type ReactNode } from "react";
import { IconLink, IconLogout } from "@/components/dash-icons";

export type DashNavItem<Tab extends string> = {
  key: Tab;
  label: string;
  icon: ReactNode;
  section?: string;
};

// The app shell for the seller dashboard: a persistent sidebar on
// desktop that collapses into a slide-in drawer on mobile (behind a
// hamburger button in the top bar), matching the layout of the
// reference dashboard the shop owner asked us to match. Kept as its
// own component so page.tsx isn't also carrying the shell's open/close
// state alongside everything else it already tracks.
export function DashboardShell<Tab extends string>({
  shopName,
  pageTitle,
  tabs,
  activeTab,
  onTabChange,
  onLogout,
  logoutLabel,
  viewShopHref,
  viewShopLabel,
  notificationSlot,
  switchSlot,
  children,
}: {
  shopName: string;
  pageTitle: string;
  tabs: DashNavItem<Tab>[];
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onLogout: () => void;
  logoutLabel: string;
  viewShopHref?: string;
  viewShopLabel: string;
  notificationSlot: ReactNode;
  switchSlot?: ReactNode;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const initial = shopName.charAt(0).toUpperCase() || "S";

  // Groups tabs under their `section` label, in the order sections
  // first appear — lets page.tsx control section order just by how it
  // orders the tabs array, with no separate config to keep in sync.
  const groups: { section: string | null; items: DashNavItem<Tab>[] }[] = [];
  for (const item of tabs) {
    const section = item.section ?? null;
    const last = groups[groups.length - 1];
    if (last && last.section === section) {
      last.items.push(item);
    } else {
      groups.push({ section, items: [item] });
    }
  }

  const navList = (
    <nav className="flex flex-col gap-1 px-3">
      {groups.map((group, i) => (
        <div key={group.section ?? i} className={i > 0 ? "mt-3" : ""}>
          {group.section && (
            <p className="px-3 pb-1 text-[10px] font-semibold tracking-wider uppercase" style={{ color: "var(--dash-muted)" }}>
              {group.section}
            </p>
          )}
          <div className="flex flex-col gap-1">
            {group.items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onTabChange(item.key);
                  setMobileOpen(false);
                }}
                className={`dash-nav-link text-left ${activeTab === item.key ? "is-active" : ""}`}
              >
                <span className="w-4 h-4 shrink-0 flex items-center justify-center" aria-hidden="true">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="dash-shell">
      <div className="mx-auto flex max-w-[1400px]">
        {/* Desktop sidebar — persistent, never overlays content */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:h-screen lg:sticky lg:top-0 border-r" style={{ borderColor: "var(--dash-border)" }}>
          <div className="flex items-center gap-2.5 px-5 py-5">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: "var(--dash-primary)" }}
            >
              {initial}
            </span>
            <span className="font-bold truncate">{shopName}</span>
          </div>
          {switchSlot && <div className="px-5 pb-4">{switchSlot}</div>}
          {navList}
          <div className="mt-auto px-3 pb-5 pt-3 flex flex-col gap-1">
            {viewShopHref && (
              <a href={viewShopHref} target="_blank" rel="noopener noreferrer" className="dash-nav-link">
                <IconLink className="w-4 h-4 shrink-0" />
                {viewShopLabel}
              </a>
            )}
            <button type="button" onClick={onLogout} className="dash-nav-link text-left" style={{ color: "var(--dash-danger)" }}>
              <IconLogout className="w-4 h-4 shrink-0" />
              {logoutLabel}
            </button>
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/30 z-30 lg:hidden"
            />
            <aside className="fixed inset-y-0 left-0 w-72 max-w-[80vw] bg-white z-40 flex flex-col lg:hidden overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ background: "var(--dash-primary)" }}
                  >
                    {initial}
                  </span>
                  <span className="font-bold truncate">{shopName}</span>
                </div>
                <button type="button" onClick={() => setMobileOpen(false)} className="text-xl leading-none px-1" aria-label="Close">
                  ×
                </button>
              </div>
              {switchSlot && <div className="px-5 pb-4">{switchSlot}</div>}
              {navList}
              <div className="mt-auto px-3 pb-5 pt-3 flex flex-col gap-1">
                {viewShopHref && (
                  <a href={viewShopHref} target="_blank" rel="noopener noreferrer" className="dash-nav-link">
                    <IconLink className="w-4 h-4 shrink-0" />
                    {viewShopLabel}
                  </a>
                )}
                <button type="button" onClick={onLogout} className="dash-nav-link text-left" style={{ color: "var(--dash-danger)" }}>
                  <IconLogout className="w-4 h-4 shrink-0" />
                  {logoutLabel}
                </button>
              </div>
            </aside>
          </>
        )}

        <div className="flex-1 min-w-0">
          <header
            className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-white border-b"
            style={{ borderColor: "var(--dash-border)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden text-xl leading-none px-1"
                aria-label="Open menu"
              >
                ☰
              </button>
              <h1 className="font-bold text-lg truncate">{pageTitle}</h1>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {notificationSlot}
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                style={{ background: "var(--dash-primary)" }}
              >
                {initial}
              </span>
            </div>
          </header>
          <main className="px-4 sm:px-6 py-6 max-w-5xl">{children}</main>
        </div>
      </div>
    </div>
  );
}
