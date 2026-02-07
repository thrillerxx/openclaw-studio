import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HackerBot OS",
    short_name: "HBOS",
    description: "Focused operator studio for the OpenClaw gateway.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#060b08",
    theme_color: "#060b08",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
