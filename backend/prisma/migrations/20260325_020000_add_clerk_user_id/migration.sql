ALTER TABLE "User"
ADD COLUMN "clerkUserId" TEXT;

ALTER TABLE "User"
ALTER COLUMN "passwordHash" DROP NOT NULL,
ALTER COLUMN "passwordSalt" DROP NOT NULL;

CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");