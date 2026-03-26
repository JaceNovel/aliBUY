import type { MetadataRoute } from "next";

import { SITE_DESCRIPTION, SITE_LOGO_PATH, SITE_NAME } from "@/lib/site-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4f4",
    theme_color: "#fa6400",
    icons: [
      {
        src: SITE_LOGO_PATH,
        sizes: "500x500",
        type: "image/png",
      },
    ],
  };
}
