"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, toggleFavorite } from "@/lib/supabase";
import { useLocale } from "./locale-provider";
import { useFavoritesContext } from "./favorites-provider";
import { IconHeart } from "./dash-icons";

// A heart toggle for saving a product to a buyer's wishlist. Gated
// behind a login the same way ChatWidget gates messaging — a favorite
// needs to survive across visits and devices, which an anonymous guest
// session can't do, so there's no attempt at a localStorage-only
// fallback here. Logged-out taps just send the buyer to log in rather
// than opening a whole explanatory panel (unlike chat, this is a single
// low-stakes action, not a conversation someone needs context for).
//
// Both the browse grid and the product page render this from a server
// component that has no way to know if a buyer is logged in (auth here
// is client-side/localStorage only) — so initial state comes from
// FavoritesProvider's one-query-per-page-load context instead of a
// prop, and stays in sync with every other instance of this button for
// the same product via that context's shared state.
export function FavoriteButton({
  productId,
  size = "md",
}: {
  productId: string;
  size?: "sm" | "md";
}) {
  const { t } = useLocale();
  const router = useRouter();
  const { ids, refresh } = useFavoritesContext();
  const contextFavorited = ids.has(productId);

  // A click needs to feel instant, not wait on the context's refresh()
  // round trip — so a local optimistic override takes over right after a
  // click and reverts on failure. It's cleared the moment the context
  // itself confirms the same value (compared during render, not synced via
  // an effect — see "Adjusting state when a prop changes" in the React
  // docs), so a change from another instance of this button for the same
  // product, or another tab, still gets picked up here instead of a stale
  // override sticking forever.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [syncedFavorited, setSyncedFavorited] = useState(contextFavorited);
  if (contextFavorited !== syncedFavorited) {
    setSyncedFavorited(contextFavorited);
    setOptimistic(null);
  }
  const favorited = optimistic ?? contextFavorited;
  const [busy, setBusy] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    // Product cards are wrapped in a <Link> to the product page — this
    // button lives inside that link, so its click must never bubble up
    // into a navigation.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    const previous = favorited;
    setOptimistic(!previous); // optimistic — feels instant on a heart toggle
    setBusy(true);
    try {
      await toggleFavorite(productId, previous);
      refresh();
    } catch {
      setOptimistic(previous); // revert on failure
    } finally {
      setBusy(false);
    }
  }

  const dim = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const pad = size === "sm" ? "p-1.5" : "p-2";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={favorited ? t.product.favoriteRemove : t.product.favoriteAdd}
      aria-pressed={favorited}
      className={`${pad} rounded-full bg-white/90 backdrop-blur-sm border border-neutral-200 hover:border-neutral-900 shadow-sm transition-colors`}
    >
      <IconHeart filled={favorited} className={`${dim} ${favorited ? "text-red-500" : "text-neutral-500"}`} />
    </button>
  );
}
