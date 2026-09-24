import type { MetadataRoute } from "next";

// Makes Buyam Sellam installable as an app (Android "Install app",
// iPhone "Add to Home Screen"). It opens full screen without the
// browser bar, with its own icon and name, and the shortcuts show up
// when the icon is long-pressed.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Buyam Sellam",
    short_name: "Buyam Sellam",
    description:
      "Cameroon's marketplace for fashion and beauty. Pay by MTN MoMo or Orange Money, held safely until you confirm delivery.",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "fr",
    dir: "ltr",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Parcourir / Browse", short_name: "Browse", url: "/browse?source=app", icons: [{ src: "/app-icon/192", sizes: "192x192" }] },
      { name: "Mon panier / My bag", short_name: "Bag", url: "/bag?source=app", icons: [{ src: "/app-icon/192", sizes: "192x192" }] },
      { name: "Suivre ma commande / Track order", short_name: "Track", url: "/track-order?source=app", icons: [{ src: "/app-icon/192", sizes: "192x192" }] },
      { name: "Ma boutique / My shop", short_name: "My shop", url: "/dashboard?source=app", icons: [{ src: "/app-icon/192", sizes: "192x192" }] },
    ],
  };
}
