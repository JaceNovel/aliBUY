import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { getCatalogProducts } from "@/lib/catalog-service";
import { type ProductCatalogItem } from "@/lib/products-data";

const SIGNATURE_SIZE = 16;

const productSignatureCache = new Map<string, Promise<Float32Array>>();

async function buildSignature(buffer: Buffer) {
  const rawBuffer = await sharp(buffer)
    .resize(SIGNATURE_SIZE, SIGNATURE_SIZE, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer();

  const signature = new Float32Array(rawBuffer.length);

  for (let index = 0; index < rawBuffer.length; index += 1) {
    signature[index] = rawBuffer[index] / 255;
  }

  return signature;
}

async function fetchRemoteImageBuffer(url: string) {
  const response = await fetch(url, { cache: "force-cache" });

  if (!response.ok) {
    throw new Error(`Unable to fetch image: ${url}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function loadProductImageBuffer(src: string) {
  if (src.startsWith("/")) {
    return readFile(path.join(process.cwd(), "public", src.replace(/^\//, "")));
  }

  return fetchRemoteImageBuffer(src);
}

function getIntentKeywords(hint?: string) {
  const normalizedHint = hint?.toLowerCase() ?? "";

  const keywordGroups = [
    {
      trigger: ["habit", "habits", "vetement", "vetements", "clothes", "fashion", "hoodie", "sweat", "tshirt", "t-shirt", "shirt", "legging", "sportwear", "activewear", "dress", "jacket"],
      boost: ["habit", "vetement", "clothes", "fashion", "hoodie", "sweat", "tshirt", "legging", "activewear", "streetwear"],
    },
  ];

  return keywordGroups
    .filter((group) => group.trigger.some((keyword) => normalizedHint.includes(keyword)))
    .flatMap((group) => group.boost);
}

function getIntentBoost(product: ProductCatalogItem, hintKeywords: string[]) {
  if (hintKeywords.length === 0) {
    return 0;
  }

  const productText = [product.title, product.shortTitle, ...(product.keywords ?? [])].join(" ").toLowerCase();
  const hasKeywordMatch = hintKeywords.some((keyword) => productText.includes(keyword));

  return hasKeywordMatch ? 0.28 : 0;
}

function getProductSignature(product: ProductCatalogItem) {
  const cached = productSignatureCache.get(product.slug);

  if (cached) {
    return cached;
  }

  const promise = loadProductImageBuffer(product.image).then((buffer) => buildSignature(buffer));
  productSignatureCache.set(product.slug, promise);
  return promise;
}

function compareSignatures(left: Float32Array, right: Float32Array) {
  let totalDifference = 0;

  for (let index = 0; index < left.length; index += 1) {
    totalDifference += Math.abs(left[index] - right[index]);
  }

  return totalDifference / left.length;
}

export async function searchProductsByImage(imageBuffer: Buffer, limit = 6, hint?: string) {
  const inputSignature = await buildSignature(imageBuffer);
  const hintKeywords = getIntentKeywords(hint);
  const products = await getCatalogProducts();
  const rankedMatches = await Promise.all(
    products.map(async (product) => {
      try {
        const productSignature = await getProductSignature(product);
        const distance = compareSignatures(inputSignature, productSignature);

        return {
          product,
          score: 1 - distance + getIntentBoost(product, hintKeywords),
        };
      } catch {
        return null;
      }
    }),
  );

  return rankedMatches
    .filter((entry): entry is { product: ProductCatalogItem; score: number } => entry !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}