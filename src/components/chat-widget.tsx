"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  getOrCreateConversation,
  getMessages,
  sendMessage,
  subscribeToMessages,
  markConversationRead,
  type Conversation,
  type ChatMessage,
} from "@/lib/messaging";
import { useLocale } from "@/components/locale-provider";
import { IconChat, IconLock } from "@/components/dash-icons";

// Replaces the pre-purchase "Chat on WhatsApp" button on the product
// and shop pages. Keeping this conversation on-platform (rather than
// handing the buyer off to WhatsApp before any money has moved) means
// a dispute has an actual transcript, and a buyer is never one message
// away from being talked into paying a seller directly and skipping
// the escrow protection that's the whole point of checking out here.
//
// WhatsApp still appears post-purchase on the order status page — once
// the payment is already held, that's just delivery logistics, which
// is exactly what WhatsApp is good at.
export function ChatWidget({
  shopId,
  shopName,
  productId,
  productTitle,
}: {
  shopId: string;
  shopName: string;
  productId?: string;
  productTitle?: string;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversation) return;
    const unsubscribe = subscribeToMessages(conversation.id, (message) => {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    });
    return unsubscribe;
  }, [conversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  async function handleOpen() {
    setOpen(true);
    if (isLoggedIn !== null) return;
    setCheckingAuth(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setIsLoggedIn(Boolean(session));
    setCheckingAuth(false);
    if (session) {
      await startConversation();
    }
  }

  async function startConversation() {
    setLoading(true);
    setError(null);
    try {
      const convo = await getOrCreateConversation(shopId, productId ?? null);
      if (!convo) {
        setIsLoggedIn(false);
        return;
      }
      setConversation(convo);
      const msgs = await getMessages(convo.id);
      setMessages(msgs);
      await markConversationRead(convo.id, "buyer");
    } catch {
      setError(t.chat.startError);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!conversation || !input.trim() || sending) return;
    setSending(true);
    setError(null);
    const body = input.trim();
    try {
      const message = await sendMessage(conversation.id, "buyer", body);
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      setInput("");
    } catch {
      setError(t.chat.sendError);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center justify-center gap-1.5 w-full text-center rounded-full border border-green-600 text-green-700 font-semibold px-6 py-3 hover:bg-green-50"
      >
        <IconChat className="w-4 h-4" /> {t.chat.messageSeller}
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-neutral-200 bg-white overflow-hidden">
          {checkingAuth ? (
            <p className="p-4 text-sm text-neutral-500">{t.account.loading}</p>
          ) : isLoggedIn === false ? (
            <div className="p-4 text-sm">
              <p className="font-semibold mb-1">{t.chat.loginRequiredTitle}</p>
              <p className="text-neutral-600 mb-3">{t.chat.loginRequiredBody}</p>
              <div className="flex items-center gap-3">
                <Link href="/login" className="rounded-full bg-neutral-900 text-white font-semibold px-4 py-2 text-sm">
                  {t.chat.logIn}
                </Link>
                <span className="text-neutral-400 text-xs">{t.chat.or}</span>
                <Link href="/buyer-signup" className="text-amber-600 hover:underline text-sm font-medium">
                  {t.chat.createAccount}
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col max-h-96">
              <div className="px-4 py-2.5 border-b border-neutral-100 bg-neutral-50">
                <p className="text-sm font-semibold truncate">
                  {t.chat.threadTitleWithShop.replace("{shopName}", shopName)}
                </p>
                {productTitle && (
                  <p className="text-xs text-neutral-500 truncate">
                    {t.chat.regardingProduct.replace("{productTitle}", productTitle)}
                  </p>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-[8rem]">
                {loading ? (
                  <p className="text-sm text-neutral-500 text-center py-6">{t.account.loading}</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-neutral-500 text-center py-6">{t.chat.empty}</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        m.sender_role === "buyer"
                          ? "self-end bg-neutral-900 text-white"
                          : "self-start bg-neutral-100 text-neutral-900"
                      }`}
                    >
                      {m.body}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
              {error && <p className="text-xs text-red-600 px-3 pb-1">{error}</p>}
              <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-neutral-100 p-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t.chat.placeholder}
                  className="flex-1 rounded-full border border-neutral-300 px-3 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="rounded-full bg-neutral-900 text-white text-sm font-semibold px-4 py-1.5 disabled:opacity-50"
                >
                  {sending ? t.chat.sending : t.chat.send}
                </button>
              </form>
              <p className="text-[11px] text-neutral-400 px-3 pb-2 flex items-center gap-1">
                <IconLock className="w-3 h-3 shrink-0" /> {t.chat.protectionNote}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
