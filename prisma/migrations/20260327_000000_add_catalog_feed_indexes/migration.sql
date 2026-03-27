CREATE INDEX IF NOT EXISTS "AlibabaImportedProductRecord_title_idx"
ON "AlibabaImportedProductRecord"("title");

CREATE INDEX IF NOT EXISTS "AlibabaImportedProductRecord_categorySlug_idx"
ON "AlibabaImportedProductRecord"("categorySlug");

CREATE INDEX IF NOT EXISTS "AlibabaImportedProductRecord_createdAt_idx"
ON "AlibabaImportedProductRecord"("createdAt");

CREATE INDEX IF NOT EXISTS "AlibabaImportedProductRecord_published_status_updatedAt_idx"
ON "AlibabaImportedProductRecord"("publishedToSite", "status", "updatedAt");

CREATE INDEX IF NOT EXISTS "AlibabaImportedProductRecord_published_status_category_updatedAt_idx"
ON "AlibabaImportedProductRecord"("publishedToSite", "status", "categorySlug", "updatedAt");