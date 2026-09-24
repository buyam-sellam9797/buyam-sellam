import { ImageResponse } from "next/og";

// App icons for the installable web app (home screen, splash screen,
// app switcher). Drawn in code so there are no binary files to keep in
// sync with the brand: black tile, white "B", amber "S" — the same
// Buyam/Sellam split as the header wordmark.
//
// "maskable" icons get cropped into circles/squircles by Android, so
// the letters sit inside the central safe zone (about 60% of the tile).
const KINDS = {
  "192": { size: 192, scale: 0.46 },
  "512": { size: 512, scale: 0.46 },
  "maskable-512": { size: 512, scale: 0.34 },
  "apple-180": { size: 180, scale: 0.44 },
} as const;

type Kind = keyof typeof KINDS;

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(KINDS).map((kind) => ({ kind }));
}

export async function GET(_request: Request, ctx: RouteContext<"/app-icon/[kind]">) {
  const { kind } = await ctx.params;
  const spec = KINDS[kind as Kind];
  if (!spec) return new Response("Not found", { status: 404 });
  const fontSize = Math.round(spec.size * spec.scale);
  // The built-in font has no bold weight; a ring of same-colour text
  // shadows thickens the strokes so the letters read at small sizes.
  const w = Math.max(1, Math.round(fontSize * 0.035));
  const bold = (color: string) =>
    [
      [w, 0], [-w, 0], [0, w], [0, -w], [w, w], [-w, -w], [w, -w], [-w, w],
    ]
      .map(([x, y]) => `${x}px ${y}px 0 ${color}`)
      .join(", ");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#171717",
          fontSize,
          fontWeight: 800,
          letterSpacing: fontSize * 0.02,
          fontFamily: "sans-serif",
        }}
      >
        <span style={{ color: "#ffffff", textShadow: bold("#ffffff") }}>B</span>
        <span style={{ color: "#f59e0b", textShadow: bold("#f59e0b") }}>S</span>
      </div>
    ),
    { width: spec.size, height: spec.size }
  );
}
