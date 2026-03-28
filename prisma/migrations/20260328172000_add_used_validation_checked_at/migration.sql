-- Add marker for used-key validation checks
ALTER TABLE "keys" ADD COLUMN "usedValidationCheckedAt" DATETIME;

-- Helps fast filtering of unverified used keys
CREATE INDEX "keys_usedValidationCheckedAt_idx" ON "keys"("usedValidationCheckedAt");
