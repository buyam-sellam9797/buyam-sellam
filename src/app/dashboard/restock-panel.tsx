"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getRestockRequestsForShop,
  markRestockNotified,
  type RestockRequest,
} from "@/lib/supabase";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import type { Dictionary } from "@/lib/i18n";
import { IconBell } from "@/components/dash-icons";

// The waitlist behind "Notify me when back in stock" on a sold-out
// product page. There's no automated SMS/push here — that needs a real
// vendor and a cost decision the shop owner hasn't made — so this is
// the seller's own worklist: see who's waiting, reach out on WhatsApp
// when the item is back, mark them as notified. Only shows people still
// waiting (notified_at is null); once marked, they drop off this list.
export function RestockPanel({ shopId, t }: { shopId: string; t: Dictionary }) {
  const [requests, setRequests] = useState<RestockRequest[] | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRequests(await getRestockRequestsForShop(shopId));
  }, [shopId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const pending = (requests ?? []).filter((r) => !r.notified_at);

  if (requests === null || pending.length === 0) return null;

  async function handleMarkNotified(id: string) {
    setMarkingId(id);
    try {
      await markRestockNotified(id);
      setRequests((prev) => (prev ? prev.map((r) => (r.id === id ? { ...r, notified_at: new Date().toISOString() } : r)) : prev));
    } finally {
      setMarkingId(null);
    }
  }

  // Grouped by product so "3 people waiting for the same item" reads as
  // one line instead of three, which is the more common real case.
  const byProduct = new Map<string, RestockRequest[]>();
  for (const r of pending) {
    const key = r.product_id;
    byProduct.set(key, [...(byProduct.get(key) ?? []), r]);
  }

  return (
    <div className="dash-card p-5 mb-6">
      <p className="text-sm font-semibold mb-1 flex items-center gap-1.5">
        <IconBell className="w-4 h-4" style={{ color: "var(--dash-gold-ink)" }} />
        {t.dashboard.restockPanelTitle}
      </p>
      <p className="text-xs mb-3" style={{ color: "var(--dash-muted)" }}>
        {t.dashboard.restockPanelHint}
      </p>
      <div className="flex flex-col gap-3">
        {Array.from(byProduct.entries()).map(([productId, group]) => (
          <div key={productId} className="rounded-lg p-3" style={{ background: "var(--dash-bg-2)" }}>
            <p className="text-sm font-medium mb-2">
              {group[0].product?.title ?? "—"} ·{" "}
              {t.dashboard.restockWaitingCount.replace("{n}", String(group.length))}
            </p>
            <div className="flex flex-col gap-1.5">
              {group.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                  <span style={{ color: "var(--dash-muted)" }}>
                    {r.contact_phone ?? r.contact_email ?? t.dashboard.restockRegisteredBuyer}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {r.contact_phone && (
                      <a
                        href={buildWhatsAppLink(
                          r.contact_phone,
                          t.dashboard.restockWhatsappMessage.replace(
                            "{title}",
                            r.product?.title ?? ""
                          )
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dash-btn-outline !py-1 !px-2.5 text-xs"
                      >
                        WhatsApp
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleMarkNotified(r.id)}
                      disabled={markingId === r.id}
                      className="text-xs hover:underline disabled:opacity-60"
                      style={{ color: "var(--dash-muted)" }}
                    >
                      {t.dashboard.restockMarkNotified}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
