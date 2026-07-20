import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FinovaSolutions Command Center",
    short_name: "Command Center",
    description: "Personal command center — projects, devs, tasks, QA, vault, reminders.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8fb",
    theme_color: "#4c4fe0",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
