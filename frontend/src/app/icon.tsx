import { readFile } from "node:fs/promises";
import path from "node:path";

import { SITE_LOGO_PATH } from "@/lib/site-config";

export const size = {
  width: 512,
  height: 512,
};
export const contentType = "image/png";

export default async function Icon() {
  const filePath = path.join(process.cwd(), "public", SITE_LOGO_PATH.replace(/^\//, ""));
  const buffer = await readFile(filePath);

  return new Response(buffer, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
