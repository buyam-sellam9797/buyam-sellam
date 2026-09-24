// "pid:qty,pid:qty" — how a shop's bag is handed from the bag page to
// the checkout page in the URL. Shared by the browser and the server.

export type BagItem = { productId: string; quantity: number };

export function encodeBagItems(lines: BagItem[]): string {
  return lines.map((l) => `${l.productId}:${l.quantity}`).join(",");
}

export function decodeBagItems(value: string | null | undefined, maxLines = 20): BagItem[] {
  if (!value) return [];
  const seen = new Map<string, number>();
  for (const part of value.split(",")) {
    const [id, q] = part.split(":");
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) continue;
    const n = Math.floor(Number(q));
    const qty = Number.isFinite(n) && n > 0 ? Math.min(n, 999) : 1;
    seen.set(id, (seen.get(id) ?? 0) + qty);
    if (seen.size >= maxLines) break;
  }
  return [...seen.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}
