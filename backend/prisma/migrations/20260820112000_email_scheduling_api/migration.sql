ALTER TABLE "Email"
ADD COLUMN "idempotencyKey" TEXT;

UPDATE "Email"
SET "idempotencyKey" = 'email-' || "id"
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "Email"
ALTER COLUMN "idempotencyKey" SET NOT NULL;

CREATE UNIQUE INDEX "Email_idempotencyKey_key" ON "Email"("idempotencyKey");
CREATE INDEX "Email_idempotencyKey_idx" ON "Email"("idempotencyKey");
