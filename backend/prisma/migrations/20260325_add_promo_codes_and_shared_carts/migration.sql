CREATE TABLE "PromoCode" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "amountType" TEXT NOT NULL,
  "amountValue" INTEGER NOT NULL,
  "minOrderFcfa" INTEGER NOT NULL DEFAULT 0,
  "maxDiscountFcfa" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "usageLimit" INTEGER,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");
CREATE INDEX "PromoCode_active_startsAt_endsAt_idx" ON "PromoCode"("active", "startsAt", "endsAt");

CREATE TABLE "SharedCartLink" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "ownerEmail" TEXT NOT NULL,
  "ownerDisplayName" TEXT NOT NULL,
  "message" TEXT,
  "itemsPayload" JSONB NOT NULL,
  "status" TEXT NOT NULL,
  "claimCount" INTEGER NOT NULL DEFAULT 0,
  "lastClaimedAt" TIMESTAMP(3),
  "claimedByUserId" TEXT,
  "claimedByDisplayName" TEXT,
  "claimedOrderId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SharedCartLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SharedCartLink_token_key" ON "SharedCartLink"("token");
CREATE INDEX "SharedCartLink_ownerUserId_createdAt_idx" ON "SharedCartLink"("ownerUserId", "createdAt");
CREATE INDEX "SharedCartLink_status_expiresAt_idx" ON "SharedCartLink"("status", "expiresAt");

ALTER TABLE "SharedCartLink"
ADD CONSTRAINT "SharedCartLink_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;