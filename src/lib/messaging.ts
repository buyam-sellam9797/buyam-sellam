import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// In-platform chat between a buyer and a shop — the replacement for
// the pre-purchase "Chat on WhatsApp" button. Keeping this on-platform
// means a dispute has an actual transcript tied to the order instead
// of a conversation that happened entirely off in WhatsApp, and it
// means a buyer never gets talked into paying a seller directly and
// skipping escrow before they've even placed an order. WhatsApp is
// still used post-purchase (order status page) for delivery logistics
// — that's low risk since the payment is already held by then.
//
// One conversation per (shop, buyer) pair (see supabase/schema.sql —
// unique(shop_id, buyer_id)); product_id just records what the buyer
// first asked about, for context in the thread header.

export type SenderRole = "buyer" | "seller";

export type Conversation = {
  id: string;
  shop_id: string;
  buyer_id: string;
  product_id: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  buyer_unread_count: number;
  seller_unread_count: number;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_role: SenderRole;
  sender_id: string;
  body: string;
  image_url: string | null;
  created_at: string;
};

export type BuyerConversation = Conversation & {
  shop: { shop_name: string; slug: string; logo_url: string | null } | null;
  product: { title: string } | null;
};

export type SellerConversation = Conversation & {
  buyer: { full_name: string | null; phone_number: string | null } | null;
  product: { title: string } | null;
};

// Finds the buyer's current user id, or null if not signed in — every
// function here needs this, since starting or reading a thread always
// requires a logged-in buyer (there's no way to deliver a reply back
// to an anonymous guest browsing session).
async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

// Buyer entry point from a product or shop page: finds the existing
// thread with this shop if one exists, otherwise starts a new one.
// Returns null if the buyer isn't signed in — the caller shows a
// login/sign-up prompt instead.
export async function getOrCreateConversation(
  shopId: string,
  productId?: string | null
): Promise<Conversation | null> {
  const buyerId = await getCurrentUserId();
  if (!buyerId) return null;

  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select("*")
    .eq("shop_id", shopId)
    .eq("buyer_id", buyerId)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from("conversations")
    .insert({ shop_id: shopId, buyer_id: buyerId, product_id: productId ?? null })
    .select("*")
    .single();
  if (insertError) throw new Error(insertError.message);
  return created;
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_role, sender_id, body, image_url, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function sendMessage(
  conversationId: string,
  senderRole: SenderRole,
  body: string,
  imageUrl?: string | null
): Promise<ChatMessage> {
  const senderId = await getCurrentUserId();
  if (!senderId) throw new Error("You need to be signed in to send a message.");
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_role: senderRole,
      sender_id: senderId,
      body: body.trim(),
      image_url: imageUrl ?? null,
    })
    .select("id, conversation_id, sender_role, sender_id, body, image_url, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// Live updates for one open thread — new messages from the other side
// appear without a refresh. Returns an unsubscribe function.
export function subscribeToMessages(
  conversationId: string,
  onInsert: (message: ChatMessage) => void
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => onInsert(payload.new as ChatMessage)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// Zeroes out the caller's own unread counter on a thread — called when
// a buyer or seller opens it. Silently ignored on failure: an unread
// badge staying lit one refresh longer isn't worth surfacing an error.
export async function markConversationRead(conversationId: string, role: SenderRole): Promise<void> {
  const column = role === "buyer" ? "buyer_unread_count" : "seller_unread_count";
  await supabase.from("conversations").update({ [column]: 0 }).eq("id", conversationId);
}

// A buyer's full inbox — every shop they've messaged, newest first, so
// they can find a reply without having to revisit the exact product
// page they messaged from.
export async function getMyConversationsAsBuyer(): Promise<BuyerConversation[]> {
  const buyerId = await getCurrentUserId();
  if (!buyerId) return [];
  const { data, error } = await supabase
    .from("conversations")
    .select("*, shop:shops(shop_name, slug, logo_url), product:products(title)")
    .eq("buyer_id", buyerId)
    .order("last_message_at", { ascending: false });
  if (error) {
    console.error("getMyConversationsAsBuyer error:", error.message);
    return [];
  }
  return (data ?? []) as unknown as BuyerConversation[];
}

// A seller's inbox for the dashboard's Messages tab.
export async function getMyConversationsAsSeller(shopId: string): Promise<SellerConversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*, buyer:profiles(full_name, phone_number), product:products(title)")
    .eq("shop_id", shopId)
    .order("last_message_at", { ascending: false });
  if (error) {
    console.error("getMyConversationsAsSeller error:", error.message);
    return [];
  }
  return (data ?? []) as unknown as SellerConversation[];
}
