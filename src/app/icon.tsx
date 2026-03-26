import { createSiteBrandImageResponse } from "@/lib/site-brand-image";

export const size = {
  width: 512,
  height: 512,
};
export const contentType = "image/png";

export default function Icon() {
  return createSiteBrandImageResponse({
    width: size.width,
    height: size.height,
    showText: false,
  });
}