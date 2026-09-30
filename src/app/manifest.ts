import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Napfpost",
    short_name: "Napfpost",
    description: "Eine Person erledigt es – die ganze Familie weiß Bescheid.",
    lang: "de",
    start_url: "/hund",
    scope: "/",
    display: "standalone",
    background_color: "#e6ecea",
    theme_color: "#1c2833",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
