import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FinovaSolutions Command Center",
    short_name: "Command Center",
    description: "Personal command center — projects, devs, tasks, QA, vault, reminders.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e1116",
    theme_color: "#e8a33d",
    // Fixed Google constant, not this project's own messagingSenderId —
    // Chrome on Android still requires this exact value in the manifest
    // for web push registration to succeed, even with VAPID keys, or
    // PushManager.subscribe() fails with "AbortError: Registration failed
    // - push service error" (the error hit in live testing).
    // @ts-expect-error -- gcm_sender_id isn't in the standard Manifest type but Android Chrome still reads it
    gcm_sender_id: "103953800507",
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
