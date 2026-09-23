// Normalises an optional email typed at checkout: trimmed, lower-case,
// and dropped (null) unless it looks like a real address.
export function cleanEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email)) return null;
  return email;
}
