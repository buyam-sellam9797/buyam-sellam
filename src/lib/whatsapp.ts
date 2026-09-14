// Builds a wa.me link with a pre-filled message. wa.me wants digits
// only (no "+", spaces or dashes), so the stored number is cleaned up
// here rather than trusting how each seller typed it in.
export function buildWhatsAppLink(phone: string, message: string): string {
  const digitsOnly = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
}
