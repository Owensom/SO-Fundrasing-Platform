import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SO Fundraising Platform",
    short_name: "SO Fundraising",
    description:
      "Support live fundraising campaigns, raffles, squares, events, auctions and donations.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f5f7",
    theme_color: "#0f172a",
    orientation: "portrait",
    icons: [
      {
        src: "/brand/icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
