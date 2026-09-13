import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cameroon is bilingual (French/English). On a visitor's very first
// request, read their browser/device's language preference and
// remember it in a cookie so every page (server and client) renders
// in the right language automatically. A visible EN/FR switcher lets
// anyone override this if we guessed wrong.
export function proxy(request: NextRequest) {
  const existing = request.cookies.get("locale")?.value;
  if (existing === "en" || existing === "fr") {
    return NextResponse.next();
  }

  const acceptLanguage = request.headers.get("accept-language") ?? "";
  const locale = acceptLanguage.toLowerCase().includes("fr") ? "fr" : "en";

  const response = NextResponse.next();
  response.cookies.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

export const config = {
  matcher: [
    // Skip static assets and API routes — only decide the language
    // for actual pages.
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
