"use client";

import { useSyncExternalStore } from "react";

// The shopping bag lives on the buyer's device (no account needed),
// grouped by shop: one shop's items are paid together in one order,
// because each shop delivers its own items. Every change notifies the
// header badge and any open bag page, including other tabs.

export type BagLine = { productId: string; shopId: string; quantity: number; addedAt: number };

const KEY = "bs_bag_v1";
const EVENT = "bs-bag-change";
export const MAX_LINES = 20;
const EMPTY: BagLine[] = [];

let cache: { raw: string | null; lines: BagLine[] } = { raw: null, lines: EMPTY };

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): BagLine[] {
  if (!raw) return EMPTY;
  try {
    const data = JSON.parse(raw) as { lines?: BagLine[] };
    if (!Array.isArray(data.lines)) return EMPTY;
    return data.lines
      .filter((l) => typeof l?.productId === "string" && typeof l?.shopId === "string")
      .map((l) => ({
        productId: l.productId,
        shopId: l.shopId,
        quantity: Math.max(1, Math.min(999, Math.floor(Number(l.quantity) || 1))),
        addedAt: Number(l.addedAt) || 0,
      }))
      .slice(0, MAX_LINES);
  } catch {
    return EMPTY;
  }
}

export function readBag(): BagLine[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = readRaw();
  if (raw !== cache.raw) cache = { raw, lines: parse(raw) };
  return cache.lines;
}

function write(lines: BagLine[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ v: 1, lines }));
  } catch {
    // storage blocked (private mode): the bag just won't persist
  }
  window.dispatchEvent(new Event(EVENT));
}

export function addToBag(input: { productId: string; shopId: string; quantity?: number; max?: number }): "added" | "updated" | "full" {
  const lines = [...readBag()];
  const existing = lines.find((l) => l.productId === input.productId);
  const add = Math.max(1, input.quantity ?? 1);
  if (existing) {
    const next = existing.quantity + add;
    existing.quantity = input.max ? Math.min(input.max, next) : next;
    write(lines.map((l) => (l.productId === input.productId ? { ...existing } : l)));
    return "updated";
  }
  if (lines.length >= MAX_LINES) return "full";
  lines.push({
    productId: input.productId,
    shopId: input.shopId,
    quantity: input.max ? Math.min(input.max, add) : add,
    addedAt: Date.now(),
  });
  write(lines);
  return "added";
}

export function setBagQuantity(productId: string, quantity: number) {
  write(readBag().map((l) => (l.productId === productId ? { ...l, quantity: Math.max(1, Math.floor(quantity)) } : l)));
}

export function removeFromBag(productId: string) {
  write(readBag().filter((l) => l.productId !== productId));
}

export function bagCount(lines: BagLine[]) {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export { encodeBagItems } from "@/lib/bag-items";

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useBag(): BagLine[] {
  return useSyncExternalStore(subscribe, readBag, () => EMPTY);
}
