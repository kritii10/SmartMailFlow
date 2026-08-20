-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Email_attempts_idx" ON "Email"("attempts");
