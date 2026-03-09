import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Agente Alma",
    short_name: "Alma",
    description:
      "SPA educativa que registra tus rutinas, gestiona tu despensa y te acompaña a comer más saludable.",
    start_url: "/",
    lang: "es-AR",
    scope: "/",
    display: "standalone",
    background_color: "#f6f3ec",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
