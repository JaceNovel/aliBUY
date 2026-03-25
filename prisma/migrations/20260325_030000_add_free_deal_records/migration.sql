CREATE TABLE IF NOT EXISTS "FreeDealConfigRecord" (
  "id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "pageTitle" TEXT NOT NULL,
  "heroBadge" TEXT NOT NULL,
  "heroTitle" TEXT NOT NULL,
  "heroSubtitle" TEXT NOT NULL,
  "bannerText" TEXT NOT NULL,
  "ctaLabel" TEXT NOT NULL,
  "shareTitle" TEXT NOT NULL,
  "shareDescription" TEXT NOT NULL,
  "itemLimit" INTEGER NOT NULL,
  "fixedPriceEur" DOUBLE PRECISION NOT NULL,
  "referralGoal" INTEGER NOT NULL,
  "dealTagText" TEXT NOT NULL,
  "productBadgeText" TEXT NOT NULL,
  "compareAtMultiplier" DOUBLE PRECISION NOT NULL,
  "compareAtExtraEur" DOUBLE PRECISION NOT NULL,
  "productSlugs" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FreeDealConfigRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FreeDealClaimRecord" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "userId" TEXT,
  "customerEmail" TEXT,
  "customerName" TEXT,
  "orderId" TEXT,
  "referralCode" TEXT NOT NULL,
  "deviceIdHash" TEXT NOT NULL,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "referralGoal" INTEGER NOT NULL,
  "referralVisitCount" INTEGER NOT NULL DEFAULT 0,
  "itemLimit" INTEGER NOT NULL,
  "fixedPriceEur" DOUBLE PRECISION NOT NULL,
  "fixedPriceFcfa" INTEGER NOT NULL,
  "selectedProductSlugs" JSONB NOT NULL,
  "paidAt" TIMESTAMP(3),
  "unlockedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FreeDealClaimRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FreeDealReferralVisitRecord" (
  "id" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "referralCode" TEXT NOT NULL,
  "visitorKeyHash" TEXT NOT NULL,
  "visitorDeviceHash" TEXT NOT NULL,
  "visitorIpHash" TEXT,
  "visitorUserAgentHash" TEXT,
  "counted" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FreeDealReferralVisitRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FreeDealClaimRecord_referralCode_key" ON "FreeDealClaimRecord"("referralCode");
CREATE UNIQUE INDEX IF NOT EXISTS "FreeDealReferralVisitRecord_claimId_visitorKeyHash_key" ON "FreeDealReferralVisitRecord"("claimId", "visitorKeyHash");

CREATE INDEX IF NOT EXISTS "FreeDealConfigRecord_updatedAt_idx" ON "FreeDealConfigRecord"("updatedAt");
CREATE INDEX IF NOT EXISTS "FreeDealClaimRecord_createdAt_idx" ON "FreeDealClaimRecord"("createdAt");
CREATE INDEX IF NOT EXISTS "FreeDealClaimRecord_orderId_idx" ON "FreeDealClaimRecord"("orderId");
CREATE INDEX IF NOT EXISTS "FreeDealClaimRecord_customerEmail_idx" ON "FreeDealClaimRecord"("customerEmail");
CREATE INDEX IF NOT EXISTS "FreeDealClaimRecord_deviceIdHash_idx" ON "FreeDealClaimRecord"("deviceIdHash");
CREATE INDEX IF NOT EXISTS "FreeDealReferralVisitRecord_referralCode_createdAt_idx" ON "FreeDealReferralVisitRecord"("referralCode", "createdAt");
CREATE INDEX IF NOT EXISTS "FreeDealReferralVisitRecord_claimId_counted_idx" ON "FreeDealReferralVisitRecord"("claimId", "counted");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'FreeDealReferralVisitRecord_claimId_fkey'
  ) THEN
    ALTER TABLE "FreeDealReferralVisitRecord"
    ADD CONSTRAINT "FreeDealReferralVisitRecord_claimId_fkey"
    FOREIGN KEY ("claimId") REFERENCES "FreeDealClaimRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;