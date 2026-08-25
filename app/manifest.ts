import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cashio",
    short_name: "Cashio",
    description: "Personal money management",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F7F7F5",
    theme_color: "#1F2937",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
