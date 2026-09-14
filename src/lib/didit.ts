import { createHmac, timingSafeEqual } from "node:crypto";

// Talks to Didit (https://didit.me) — the third-party service that
// checks a seller's ID card and a live selfie actually match, and
// that the ID document itself looks genuine. Buyam Sellam never does
// this checking itself and never sees the ID photo or selfie: it only
// starts a session, sends the seller's browser to Didit's own secure
// page, and reads back the verdict via a webhook.
//
// Built from Didit's published docs (docs.didit.me) as of September
// 2026 — not yet tested against a live Didit account, since that
// needs a real signup first. If the first real attempt doesn't work,
// the most likely culprits are the exact API path (Didit has iterated
// between v2 and v3) or a webhook field name — both isolated to this
// one file and the webhook route, so a fix should stay small.
const DIDIT_API_BASE = "https://verification.didit.me/v3";

export type DiditSession = {
  session_id: string;
  url: string;
  status: string;
};

// Starts a new verification session for one shop and returns the
// hosted page URL to send the seller's browser to. Didit runs the
// entire ID-scan + live-selfie + face-match flow on its own page.
export async function createDiditSession(input: {
  shopId: string;
  callbackUrl: string;
}): Promise<DiditSession> {
  const apiKey = process.env.DIDIT_API_KEY;
  const workflowId = process.env.DIDIT_WORKFLOW_ID;
  if (!apiKey || !workflowId) {
    throw new Error("Identity verification isn't set up yet.");
  }

  const res = await fetch(`${DIDIT_API_BASE}/session/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({
      workflow_id: workflowId,
      // Lets the webhook match the result straight back to a shop
      // without needing a separate lookup table.
      vendor_data: input.shopId,
      callback: input.callbackUrl,
      callback_method: "both",
    }),
  });

  if (!res.ok) {
    throw new Error(`Could not start identity verification (status ${res.status}).`);
  }

  const data = await res.json();
  return { session_id: data.session_id, url: data.url, status: data.status };
}

// Confirms a webhook request actually came from Didit: an HMAC-SHA256
// of the raw request body using the webhook secret from the Didit
// console, plus a freshness check so an intercepted request can't be
// replayed later. Must run on the raw body text, before any JSON
// parsing — re-stringifying can shift whitespace and break the match.
export function verifyDiditWebhook(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !timestampHeader || !secret) return false;

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) return false;
  const ageSeconds = Math.abs(Date.now() / 1000 - timestamp);
  if (ageSeconds > 300) return false; // older than 5 minutes — treat as stale/replayed

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const givenBuf = Buffer.from(signatureHeader, "utf8");
  if (expectedBuf.length !== givenBuf.length) return false;
  return timingSafeEqual(expectedBuf, givenBuf);
}

// Didit's session status strings, mapped to the four values stored on
// shops.identity_verification_status. "Abandoned" (the seller closed
// the tab partway through) is treated the same as "Declined" — either
// way, nothing was confirmed, so the seller just tries again.
export function mapDiditStatus(status: string | undefined): "pending" | "in_review" | "approved" | "declined" {
  switch (status) {
    case "Approved":
      return "approved";
    case "In Review":
      return "in_review";
    case "Declined":
    case "Abandoned":
      return "declined";
    default:
      return "pending"; // "Not Started" / "In Progress"
  }
}
