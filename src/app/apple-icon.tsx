import { createSiteBrandImageResponse } from "@/lib/site-brand-image";

export const size = {
  width: 512,
  height: 512,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return createSiteBrandImageResponse({
    width: size.width,
    height: size.height,
    showText: false,
  });
}