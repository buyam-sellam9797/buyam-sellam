"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getMyConversationsAsSeller,
  getMessages,
  sendMessage,
  subscribeToMessages,
  markConversationRead,
  type SellerConversation,
  type ChatMessage,
} from "@/lib/messaging";
import type { Dictionary } from "@/lib/i18n";
import { IconChat } from "@/components/dash-icons";

// The seller side of the in-platform chat that replaced the pre-purchase
// "Chat on WhatsApp" button — buyers now message a shop from here
// instead of leaving the platform, which gives disputes an actual
// transcript instead of a conversation nobody but the two parties ever
// saw. This mirrors ReviewsPanel/DeliveryZonesPanel's shape (a self-
// contained panel that loads its own data) but lives in its own file
// since dashboard/page.tsx was already large.
export function MessagesPanel({ shopId, t }: { shopId: string; t: Dictionary }) {
  const [conversations, setConversations] = useState<SellerConversation[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setConversations(await getMyConversationsAsSeller(shopId));
  }, [shopId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConversations();
  }, [loadConversations]);

  // Live-refreshes the inbox list (new thread, new unread count) while
  // this tab is open, without the seller needing to switch tabs and back.
  useEffect(() => {
    const channel = supabase
      .channel(`seller-conversations:${shopId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `shop_id=eq.${shopId}` },
        () => loadConversations()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopId, loadConversations]);

  const selected = conversations?.find((c) => c.id === selectedId) ?? null;

  const openConversation = useCallback(async (id: string) => {
    setSelectedId(id);
    setLoadingThread(true);
    setError(null);
    try {
      const msgs = await getMessages(id);
      setMessages(msgs);
      await markConversationRead(id, "seller");
      setConversations((prev) => (prev ? prev.map((c) => (c.id === id ? { ...c, seller_unread_count: 0 } : c)) : prev));
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const unsubscribe = subscribeToMessages(selectedId, (message) => {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    });
    return unsubscribe;
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !input.trim() || sending) return;
    setSending(true);
    setError(null);
    const body = input.trim();
    try {
      const message = await sendMessage(selectedId, "seller", body);
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      setInput("");
    } catch {
      setError(t.dashboard.messagesSendError);
    } finally {
      setSending(false);
    }
  }

  if (conversations === null) {
    return <p className="text-sm" style={{ color: "var(--dash-muted)" }}>{t.dashboard.loading}</p>;
  }

  if (conversations.length === 0) {
    return (
      <div className="dash-card p-8 text-center">
        <IconChat className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--dash-muted)" }} />
        <p className="text-sm font-semibold mb-1">{t.dashboard.messagesEmptyTitle}</p>
        <p className="text-sm" style={{ color: "var(--dash-muted)" }}>{t.dashboard.messagesEmptyBody}</p>
      </div>
    );
  }

  return (
    <div className="dash-card overflow-hidden grid sm:grid-cols-[16rem_1fr]" style={{ minHeight: "28rem" }}>
      <div className="border-b sm:border-b-0 sm:border-r divide-y overflow-y-auto" style={{ borderColor: "var(--dash-border)", maxHeight: "32rem" }}>
        {conversations.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => openConversation(c.id)}
            className="w-full text-left px-4 py-3 hover:bg-black/[0.02] flex flex-col gap-0.5"
            style={{
              background: c.id === selectedId ? "var(--dash-primary-wash)" : undefined,
              borderColor: "var(--dash-border)",
            }}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold truncate">
                {c.buyer?.full_name || t.dashboard.messagesAnonymousBuyer}
              </span>
              {c.seller_unread_count > 0 && (
                <span
                  className="text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0"
                  style={{ background: "var(--dash-gold)", color: "var(--dash-gold-ink)" }}
                >
                  {c.seller_unread_count}
                </span>
              )}
            </span>
            {c.product?.title && (
              <span className="text-xs truncate" style={{ color: "var(--dash-muted)" }}>
                {t.dashboard.messagesRegarding.replace("{productTitle}", c.product.title)}
              </span>
            )}
            {c.last_message_preview && (
              <span className="text-xs truncate" style={{ color: "var(--dash-muted)" }}>
                {c.last_message_preview}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center p-8 text-sm" style={{ color: "var(--dash-muted)" }}>
            <IconChat className="w-5 h-5 mr-2" /> {t.dashboard.messagesEmptyBody}
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--dash-border)" }}>
              <p className="text-sm font-semibold">{selected.buyer?.full_name || t.dashboard.messagesAnonymousBuyer}</p>
              {selected.product?.title && (
                <p className="text-xs" style={{ color: "var(--dash-muted)" }}>
                  {t.dashboard.messagesRegarding.replace("{productTitle}", selected.product.title)}
                </p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2" style={{ maxHeight: "24rem" }}>
              {loadingThread ? (
                <p className="text-sm text-center py-6" style={{ color: "var(--dash-muted)" }}>{t.dashboard.loading}</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.sender_role === "seller" ? "self-end" : "self-start"}`}
                    style={
                      m.sender_role === "seller"
                        ? { background: "var(--dash-ink)", color: "white" }
                        : { background: "var(--dash-bg)", color: "var(--dash-ink)" }
                    }
                  >
                    {m.body}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
            {error && <p className="text-xs text-red-600 px-4 pb-1">{error}</p>}
            <form onSubmit={handleSend} className="flex items-center gap-2 border-t p-3" style={{ borderColor: "var(--dash-border)" }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t.dashboard.messagesReplyPlaceholder}
                className="dash-input flex-1"
              />
              <button type="submit" disabled={sending || !input.trim()} className="dash-btn !py-1.5 !px-4 text-sm">
                {sending ? t.dashboard.messagesSending : t.dashboard.messagesSend}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
