"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getMyFavoriteProductIds } from "@/lib/supabase";

type FavoritesContextValue = {
  ids: Set<string>;
  refresh: () => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

// Wraps the whole app (see layout.tsx), the same way LocaleProvider
// does, so every FavoriteButton anywhere on the site knows the buyer's
// current favorites with one query per page load instead of one query
// per product card. Silently does nothing for guests (the query
// resolves to an empty set when there's no session) — favoriting still
// requires logging in, this just avoids a flash of "not favorited" on
// pages a logged-in buyer already has favorites on.
export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(() => {
    getMyFavoriteProductIds().then(setIds);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <FavoritesContext.Provider value={{ ids, refresh }}>{children}</FavoritesContext.Provider>;
}

// Returns whether a product is favorited, and a function to call right
// after toggling it so every FavoriteButton for that product (a card in
// a grid and the same product open in another tab) stays in sync. Safe
// to call outside a <FavoritesProvider> — falls back to "not favorited"
// rather than throwing, since a couple of one-off internal tools render
// outside the main app tree.
export function useFavoritesContext() {
  const ctx = useContext(FavoritesContext);
  return ctx ?? { ids: new Set<string>(), refresh: () => {} };
}
