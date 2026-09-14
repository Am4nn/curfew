import type { MetadataRoute } from "next";

// What "Add to Home Screen" reads.
//
// Curfew is used as an installed app on a phone, so this is the difference
// between a browser tab with a URL bar over it and something that opens like an
// app. `display: standalone` takes the chrome away; `background_color` is what
// Android paints during a cold start, so it is --bg and not white, or the app
// flashes a white card every launch.
//
// `id` is set explicitly. Without it the identity is derived from `start_url`,
// and changing that later would register as a different app and leave a second
// icon on the home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Curfew",
    short_name: "Curfew",
    description: "Track what you said you would do, and prove it.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0a09",
    theme_color: "#0b0a09",
    categories: ["health", "lifestyle", "productivity"],
    icons: [
      // `any` bleeds to the edge; `maskable` keeps the mark inside the safe
      // circle so a launcher that crops to a shape does not cut its corners
      // off. Declaring one as both is how you get a mark with clipped corners
      // on one phone and a floating postage stamp on another.
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
