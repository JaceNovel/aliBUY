CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "AlibabaImportedProductRecord"
ADD COLUMN IF NOT EXISTS "viewsCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AlibabaImportedProductRecord"
ADD COLUMN IF NOT EXISTS "salesCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "AlibabaImportedProductRecord_title_trgm_idx"
ON "AlibabaImportedProductRecord" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "AlibabaImportedProductRecord_shortTitle_trgm_idx"
ON "AlibabaImportedProductRecord" USING gin ("shortTitle" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "AlibabaImportedProductRecord_viewsCount_idx"
ON "AlibabaImportedProductRecord"("viewsCount");

CREATE INDEX IF NOT EXISTS "AlibabaImportedProductRecord_salesCount_idx"
ON "AlibabaImportedProductRecord"("salesCount");

CREATE INDEX IF NOT EXISTS "AlibabaImportedProductRecord_published_status_popularity_idx"
ON "AlibabaImportedProductRecord"("publishedToSite", "status", "salesCount", "viewsCount", "publishedAt");