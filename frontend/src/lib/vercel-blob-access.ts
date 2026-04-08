export type VercelBlobAccessMode = "public" | "private";

export function getVercelBlobAccessMode(): VercelBlobAccessMode {
  const rawValue = (process.env.BLOB_ACCESS ?? process.env.VERCEL_BLOB_ACCESS ?? "").trim().toLowerCase();
  return rawValue === "private" ? "private" : "public";
}