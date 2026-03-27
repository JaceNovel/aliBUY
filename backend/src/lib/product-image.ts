const CLOUDFLARE_IMAGE_RESIZING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_CLOUDFLARE_IMAGE_RESIZING === "1";

type ProductImageOptions = {
  width?: number;
  quality?: number;
  fit?: "cover" | "contain" | "scale-down";
};

export function getProductImageUrl(source: string, options?: ProductImageOptions) {
  const normalizedSource = source.trim();
  if (!normalizedSource || !CLOUDFLARE_IMAGE_RESIZING_ENABLED) {
    return normalizedSource;
  }

  if (normalizedSource.startsWith("/cdn-cgi/image/")) {
    return normalizedSource;
  }

  const width = options?.width ?? 480;
  const quality = options?.quality ?? 75;
  const fit = options?.fit ?? "cover";

  return `/cdn-cgi/image/format=auto,width=${width},quality=${quality},fit=${fit}/${encodeURI(normalizedSource)}`;
}