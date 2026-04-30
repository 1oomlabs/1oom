-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "chainId" INTEGER NOT NULL,
    "parameters" JSONB NOT NULL,
    "trigger" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "keeperJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_listings" (
    "id" TEXT NOT NULL,
    "workflow" JSONB NOT NULL,
    "author" TEXT NOT NULL,
    "tags" TEXT[],
    "pricing" JSONB NOT NULL,
    "stats" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actions" TEXT[],

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflows_owner_idx" ON "workflows"("owner");

-- CreateIndex
CREATE INDEX "marketplace_listings_author_idx" ON "marketplace_listings"("author");
