-- Add marker for problematic-key validation checks
ALTER TABLE "keys" ADD COLUMN "problematicValidationCheckedAt" DATETIME;

-- Helps fast filtering of unverified problematic keys
CREATE INDEX "keys_problematicValidationCheckedAt_idx" ON "keys"("problematicValidationCheckedAt");
