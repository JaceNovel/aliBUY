-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."AlibabaCountryProfileRecord" (
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "defaultCarrierCode" TEXT NOT NULL,
    "importTaxRate" DOUBLE PRECISION NOT NULL,
    "customsMode" TEXT NOT NULL,
    "clearanceCodeLabel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AlibabaCountryProfileRecord_pkey" PRIMARY KEY ("countryCode")
);

-- CreateTable
CREATE TABLE "public"."AlibabaImportJobRecord" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "limit" INTEGER NOT NULL,
    "fulfillmentChannel" TEXT NOT NULL,
    "autoPublish" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "productIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlibabaImportJobRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlibabaImportedProductRecord" (
    "id" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "categorySlug" TEXT,
    "categoryTitle" TEXT,
    "categoryPath" JSONB,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortTitle" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "keywords" JSONB NOT NULL,
    "image" TEXT NOT NULL,
    "gallery" JSONB NOT NULL,
    "videoUrl" TEXT,
    "videoPoster" TEXT,
    "packaging" TEXT NOT NULL,
    "itemWeightGrams" INTEGER NOT NULL,
    "lotCbm" TEXT NOT NULL,
    "minUsd" DOUBLE PRECISION NOT NULL,
    "maxUsd" DOUBLE PRECISION,
    "moq" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "badge" TEXT,
    "supplierName" TEXT NOT NULL,
    "supplierLocation" TEXT NOT NULL,
    "supplierCompanyId" TEXT,
    "responseTime" TEXT NOT NULL,
    "yearsInBusiness" INTEGER NOT NULL,
    "transactionsLabel" TEXT NOT NULL,
    "soldLabel" TEXT NOT NULL,
    "customizationLabel" TEXT NOT NULL,
    "shippingLabel" TEXT NOT NULL,
    "overview" JSONB NOT NULL,
    "variantGroups" JSONB NOT NULL,
    "tiers" JSONB NOT NULL,
    "specs" JSONB NOT NULL,
    "inventory" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "publishedToSite" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlibabaImportedProductRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlibabaIntegrationLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "action" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestBody" JSONB,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlibabaIntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlibabaPurchaseOrderRecord" (
    "id" TEXT NOT NULL,
    "sourceImportedProductId" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierCompanyId" TEXT,
    "quantity" INTEGER NOT NULL,
    "shippingAddressId" TEXT NOT NULL,
    "logisticsPayload" JSONB NOT NULL,
    "buyNowPayload" JSONB NOT NULL,
    "freightStatus" TEXT NOT NULL,
    "orderStatus" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "tradeId" TEXT,
    "payUrl" TEXT,
    "payFailureReason" TEXT,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "rawFreightResponse" JSONB,
    "rawOrderResponse" JSONB,
    "rawPaymentResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlibabaPurchaseOrderRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlibabaReceptionAddressRecord" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT,
    "countryCode" TEXT NOT NULL,
    "port" TEXT,
    "portCode" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlibabaReceptionAddressRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlibabaReceptionRecordItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "quantityExpected" INTEGER NOT NULL,
    "quantityReceived" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlibabaReceptionRecordItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlibabaSupplierAccountRecord" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accountPlatform" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "defaultDispatchLocation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "memberId" TEXT,
    "resourceOwner" TEXT,
    "appKey" TEXT,
    "appSecret" JSONB,
    "authorizeUrl" TEXT,
    "tokenUrl" TEXT,
    "refreshUrl" TEXT,
    "apiBaseUrl" TEXT,
    "accessToken" JSONB,
    "refreshToken" JSONB,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "accountId" TEXT,
    "accountLogin" TEXT,
    "accountName" TEXT,
    "oauthCountry" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "hasAppSecret" BOOLEAN NOT NULL DEFAULT false,
    "hasAccessToken" BOOLEAN NOT NULL DEFAULT false,
    "hasRefreshToken" BOOLEAN NOT NULL DEFAULT false,
    "lastAuthorizedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "accessTokenHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlibabaSupplierAccountRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT,
    "countryCode" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderRemittanceProof" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountLabel" TEXT NOT NULL,
    "transferDate" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankReference" TEXT NOT NULL,
    "comment" TEXT,
    "fileName" TEXT,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderRemittanceProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuoteRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "specifications" TEXT NOT NULL,
    "budget" TEXT NOT NULL,
    "shippingWindow" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SourcingOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT,
    "countryCode" TEXT NOT NULL,
    "shippingMethod" TEXT NOT NULL,
    "shippingCostFcfa" INTEGER NOT NULL,
    "cartProductsTotalFcfa" INTEGER NOT NULL,
    "totalPriceFcfa" INTEGER NOT NULL,
    "totalWeightKg" DECIMAL(10,3) NOT NULL,
    "totalVolumeCbm" DECIMAL(10,4) NOT NULL,
    "status" TEXT NOT NULL,
    "freightStatus" TEXT NOT NULL,
    "supplierOrderStatus" TEXT NOT NULL,
    "alibabaTradeIds" JSONB,
    "freightPayload" JSONB,
    "supplierOrderPayload" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "containerId" TEXT,
    "monerooCheckoutUrl" TEXT,
    "monerooInitializedAt" TIMESTAMP(3),
    "monerooPaymentId" TEXT,
    "monerooPaymentPayload" JSONB,
    "monerooPaymentStatus" TEXT,
    "monerooVerifiedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentCurrency" TEXT NOT NULL DEFAULT 'XOF',
    "paymentProvider" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "userId" TEXT,
    "customerAddressId" TEXT,

    CONSTRAINT "SourcingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SourcingOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "supplierPriceFcfa" INTEGER NOT NULL,
    "marginMode" TEXT NOT NULL,
    "marginValue" DECIMAL(12,2) NOT NULL,
    "marginAmountFcfa" INTEGER NOT NULL,
    "finalUnitPriceFcfa" INTEGER NOT NULL,
    "finalLinePriceFcfa" INTEGER NOT NULL,
    "weightKg" DECIMAL(10,3) NOT NULL,
    "volumeCbm" DECIMAL(10,4) NOT NULL,
    "image" TEXT NOT NULL,

    CONSTRAINT "SourcingOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SourcingSeaContainer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "targetCbm" DECIMAL(10,4) NOT NULL,
    "currentCbm" DECIMAL(10,4) NOT NULL,
    "fillPercent" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "readyToShipAt" TIMESTAMP(3),
    "shipmentTriggeredAt" TIMESTAMP(3),

    CONSTRAINT "SourcingSeaContainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SourcingSettings" (
    "id" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'XOF',
    "airRatePerKgFcfa" INTEGER NOT NULL,
    "airEstimatedDays" TEXT NOT NULL,
    "seaRealCostPerCbmFcfa" INTEGER NOT NULL,
    "seaSellRatePerCbmFcfa" INTEGER NOT NULL,
    "seaEstimatedDays" TEXT NOT NULL,
    "freeAirThresholdFcfa" INTEGER NOT NULL,
    "freeAirEnabled" BOOLEAN NOT NULL DEFAULT true,
    "airWeightThresholdKg" DECIMAL(10,3) NOT NULL,
    "containerTargetCbm" DECIMAL(10,4) NOT NULL,
    "defaultMarginMode" TEXT NOT NULL,
    "defaultMarginValue" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourcingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupportConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tab" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupportMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordSalt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlibabaImportJobRecord_status_idx" ON "public"."AlibabaImportJobRecord"("status" ASC);

-- CreateIndex
CREATE INDEX "AlibabaImportJobRecord_updatedAt_idx" ON "public"."AlibabaImportJobRecord"("updatedAt" ASC);

-- CreateIndex
CREATE INDEX "AlibabaImportedProductRecord_publishedToSite_idx" ON "public"."AlibabaImportedProductRecord"("publishedToSite" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AlibabaImportedProductRecord_slug_key" ON "public"."AlibabaImportedProductRecord"("slug" ASC);

-- CreateIndex
CREATE INDEX "AlibabaImportedProductRecord_status_idx" ON "public"."AlibabaImportedProductRecord"("status" ASC);

-- CreateIndex
CREATE INDEX "AlibabaImportedProductRecord_updatedAt_idx" ON "public"."AlibabaImportedProductRecord"("updatedAt" ASC);

-- CreateIndex
CREATE INDEX "AlibabaIntegrationLog_createdAt_idx" ON "public"."AlibabaIntegrationLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "AlibabaIntegrationLog_status_idx" ON "public"."AlibabaIntegrationLog"("status" ASC);

-- CreateIndex
CREATE INDEX "AlibabaPurchaseOrderRecord_orderStatus_idx" ON "public"."AlibabaPurchaseOrderRecord"("orderStatus" ASC);

-- CreateIndex
CREATE INDEX "AlibabaPurchaseOrderRecord_paymentStatus_idx" ON "public"."AlibabaPurchaseOrderRecord"("paymentStatus" ASC);

-- CreateIndex
CREATE INDEX "AlibabaPurchaseOrderRecord_updatedAt_idx" ON "public"."AlibabaPurchaseOrderRecord"("updatedAt" ASC);

-- CreateIndex
CREATE INDEX "AlibabaReceptionAddressRecord_isDefault_idx" ON "public"."AlibabaReceptionAddressRecord"("isDefault" ASC);

-- CreateIndex
CREATE INDEX "AlibabaReceptionAddressRecord_updatedAt_idx" ON "public"."AlibabaReceptionAddressRecord"("updatedAt" ASC);

-- CreateIndex
CREATE INDEX "AlibabaReceptionRecordItem_purchaseOrderId_idx" ON "public"."AlibabaReceptionRecordItem"("purchaseOrderId" ASC);

-- CreateIndex
CREATE INDEX "AlibabaReceptionRecordItem_status_idx" ON "public"."AlibabaReceptionRecordItem"("status" ASC);

-- CreateIndex
CREATE INDEX "AlibabaReceptionRecordItem_updatedAt_idx" ON "public"."AlibabaReceptionRecordItem"("updatedAt" ASC);

-- CreateIndex
CREATE INDEX "AlibabaSupplierAccountRecord_isActive_status_idx" ON "public"."AlibabaSupplierAccountRecord"("isActive" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "AlibabaSupplierAccountRecord_status_idx" ON "public"."AlibabaSupplierAccountRecord"("status" ASC);

-- CreateIndex
CREATE INDEX "AlibabaSupplierAccountRecord_updatedAt_idx" ON "public"."AlibabaSupplierAccountRecord"("updatedAt" ASC);

-- CreateIndex
CREATE INDEX "CustomerAddress_userId_createdAt_idx" ON "public"."CustomerAddress"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "CustomerAddress_userId_isDefault_idx" ON "public"."CustomerAddress"("userId" ASC, "isDefault" ASC);

-- CreateIndex
CREATE INDEX "Favorite_productSlug_idx" ON "public"."Favorite"("productSlug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_productSlug_key" ON "public"."Favorite"("userId" ASC, "productSlug" ASC);

-- CreateIndex
CREATE INDEX "OrderRemittanceProof_orderId_createdAt_idx" ON "public"."OrderRemittanceProof"("orderId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "OrderRemittanceProof_userId_createdAt_idx" ON "public"."OrderRemittanceProof"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "QuoteRequest_userId_createdAt_idx" ON "public"."QuoteRequest"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "SourcingOrder_createdAt_idx" ON "public"."SourcingOrder"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "SourcingOrder_customerAddressId_idx" ON "public"."SourcingOrder"("customerAddressId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SourcingOrder_monerooPaymentId_key" ON "public"."SourcingOrder"("monerooPaymentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SourcingOrder_orderNumber_key" ON "public"."SourcingOrder"("orderNumber" ASC);

-- CreateIndex
CREATE INDEX "SourcingOrder_paymentStatus_idx" ON "public"."SourcingOrder"("paymentStatus" ASC);

-- CreateIndex
CREATE INDEX "SourcingOrder_shippingMethod_idx" ON "public"."SourcingOrder"("shippingMethod" ASC);

-- CreateIndex
CREATE INDEX "SourcingOrder_status_idx" ON "public"."SourcingOrder"("status" ASC);

-- CreateIndex
CREATE INDEX "SourcingOrder_userId_idx" ON "public"."SourcingOrder"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SourcingSeaContainer_code_key" ON "public"."SourcingSeaContainer"("code" ASC);

-- CreateIndex
CREATE INDEX "SupportConversation_orderId_idx" ON "public"."SupportConversation"("orderId" ASC);

-- CreateIndex
CREATE INDEX "SupportConversation_userId_updatedAt_idx" ON "public"."SupportConversation"("userId" ASC, "updatedAt" ASC);

-- CreateIndex
CREATE INDEX "SupportMessage_conversationId_createdAt_idx" ON "public"."SupportMessage"("conversationId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- AddForeignKey
ALTER TABLE "public"."AlibabaIntegrationLog" ADD CONSTRAINT "AlibabaIntegrationLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."SourcingOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerAddress" ADD CONSTRAINT "CustomerAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderRemittanceProof" ADD CONSTRAINT "OrderRemittanceProof_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."SourcingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuoteRequest" ADD CONSTRAINT "QuoteRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SourcingOrder" ADD CONSTRAINT "SourcingOrder_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "public"."SourcingSeaContainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SourcingOrder" ADD CONSTRAINT "SourcingOrder_customerAddressId_fkey" FOREIGN KEY ("customerAddressId") REFERENCES "public"."CustomerAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SourcingOrder" ADD CONSTRAINT "SourcingOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SourcingOrderItem" ADD CONSTRAINT "SourcingOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."SourcingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupportConversation" ADD CONSTRAINT "SupportConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupportMessage" ADD CONSTRAINT "SupportMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

