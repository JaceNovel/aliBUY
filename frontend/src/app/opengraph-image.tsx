import { createSiteBrandImageResponse } from "@/lib/site-brand-image";
import { SITE_NAME } from "@/lib/site-config";

export const alt = `${SITE_NAME} preview`;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return createSiteBrandImageResponse({
    width: size.width,
    height: size.height,
    showText: true,
  });
}