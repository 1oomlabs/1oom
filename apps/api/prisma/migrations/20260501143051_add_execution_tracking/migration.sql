-- AlterTable
ALTER TABLE "workflows" ADD COLUMN     "lastRunAt" TIMESTAMP(3),
ADD COLUMN     "runCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "executions" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "executions_workflowId_createdAt_idx" ON "executions"("workflowId", "createdAt");

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
