import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// Web Push (phone/desktop notifications) without an extra library:
//  - VAPID (RFC 8292): a short signed token proving the push comes from us
//  - payload encryption "aes128gcm" (RFC 8291 / RFC 8188), so only the
//    subscriber's device can read the message
//
// The VAPID key pair lives in the private `app_secrets` table (readable
// only with the service role), not in an environment variable, so it
// never has to be copied around by hand.

const SUBJECT = "mailto:support@buyamsellam.shop";

// Push services we are willing to POST to. Subscriptions pointing
// anywhere else are refused, so nobody can use our server to call
// arbitrary URLs.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
  /^[a-z0-9.-]+\.notify\.windows\.com$/,
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

const b64url = (buf: Buffer) => buf.toString("base64url");
const fromB64url = (s: string) => Buffer.from(s, "base64url");

export type VapidKeys = { publicKey: string; privateKey: string };

export function generateVapidKeys(): VapidKeys {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return { publicKey: b64url(ecdh.getPublicKey()), privateKey: b64url(ecdh.getPrivateKey()) };
}

let cachedKeys: VapidKeys | null = null;

export async function getVapidKeys(admin: SupabaseClient): Promise<VapidKeys | null> {
  if (cachedKeys) return cachedKeys;
  const { data } = await admin.from("app_secrets").select("key, value").in("key", ["vapid_public_key", "vapid_private_key"]);
  const pub = data?.find((r) => r.key === "vapid_public_key")?.value;
  const priv = data?.find((r) => r.key === "vapid_private_key")?.value;
  if (!pub || !priv) return null;
  cachedKeys = { publicKey: pub, privateKey: priv };
  return cachedKeys;
}

export function vapidAuthHeader(endpoint: string, keys: VapidKeys, now = Math.floor(Date.now() / 1000)): string {
  const pub = fromB64url(keys.publicKey);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: keys.privateKey,
    x: b64url(pub.subarray(1, 33)),
    y: b64url(pub.subarray(33, 65)),
  };
  const key = crypto.createPrivateKey({ key: jwk, format: "jwk" });
  const header = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: now + 12 * 3600, sub: SUBJECT })));
  const signingInput = `${header}.${claims}`;
  const signature = crypto.sign("sha256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${signingInput}.${b64url(signature)}, k=${keys.publicKey}`;
}

function hmac(key: Buffer, data: Buffer): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

/** Encrypts one push message for one subscription (RFC 8291, single record). */
export function encryptPayload(
  payload: Buffer,
  subscriberPublicKey: string,
  subscriberAuth: string,
  // Test hooks: fixed sender key and salt make the output reproducible.
  fixed?: { senderPrivateKey?: Buffer; salt?: Buffer }
): Buffer {
  const uaPublic = fromB64url(subscriberPublicKey);
  const authSecret = fromB64url(subscriberAuth);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error("Invalid subscription keys");

  const sender = crypto.createECDH("prime256v1");
  if (fixed?.senderPrivateKey) sender.setPrivateKey(fixed.senderPrivateKey);
  else sender.generateKeys();
  const asPublic = sender.getPublicKey();
  const ecdhSecret = sender.computeSecret(uaPublic);

  // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info\0" || ua_public || as_public, 32)
  const prkKey = hmac(authSecret, ecdhSecret);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])]);
  const ikm = hmac(prkKey, keyInfo);

  const salt = fixed?.salt ?? crypto.randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: aes128gcm\0"), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: nonce\0"), Buffer.from([1])])).subarray(0, 12);

  // Single, final record: plaintext followed by the 0x02 delimiter.
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);

  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);
  return Buffer.concat([salt, recordSize, Buffer.from([asPublic.length]), asPublic, body]);
}

export type PushMessage = {
  title: string;
  body?: string | null;
  /** Page to open when the notification is tapped (same-site path). */
  url?: string;
  /** Notifications with the same tag replace each other instead of piling up. */
  tag?: string;
  urgency?: "high" | "normal" | "low";
};

type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

async function sendOne(sub: SubscriptionRow, message: PushMessage, keys: VapidKeys): Promise<"ok" | "gone" | "failed"> {
  if (!isAllowedPushEndpoint(sub.endpoint)) return "gone";
  const payload = Buffer.from(
    JSON.stringify({
      title: message.title.slice(0, 120),
      body: (message.body ?? "").slice(0, 240),
      url: message.url && message.url.startsWith("/") ? message.url : "/",
      tag: message.tag,
    })
  );
  try {
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuthHeader(sub.endpoint, keys),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(2 * 24 * 3600),
        Urgency: message.urgency ?? "normal",
      },
      body: new Uint8Array(encryptPayload(payload, sub.p256dh, sub.auth)),
      signal: AbortSignal.timeout(6000),
    });
    if (res.status === 404 || res.status === 410) return "gone";
    if (!res.ok) {
      console.error("push rejected:", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return "failed";
    }
    return "ok";
  } catch (err) {
    console.error("push send failed:", err instanceof Error ? err.message : err);
    return "failed";
  }
}

/**
 * Sends a notification to every device a user has turned notifications
 * on for. Never throws: a failed push must not break the order, offer
 * or payment flow that triggered it.
 */
export async function sendPushToUser(admin: SupabaseClient, userId: string | null | undefined, message: PushMessage): Promise<void> {
  if (!userId) return;
  try {
    const keys = await getVapidKeys(admin);
    if (!keys) return;
    const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId).limit(10);
    if (!subs?.length) return;
    const results = await Promise.all(subs.map((s) => sendOne(s as SubscriptionRow, message, keys)));
    const gone = subs.filter((_, i) => results[i] === "gone").map((s) => s.id);
    const sent = subs.filter((_, i) => results[i] === "ok").map((s) => s.id);
    if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
    if (sent.length) await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).in("id", sent);
  } catch (err) {
    console.error("sendPushToUser failed:", err instanceof Error ? err.message : err);
  }
}

/** Short notification text from an email's first paragraph. */
export function pushBody(text: string | undefined | null, max = 160): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
