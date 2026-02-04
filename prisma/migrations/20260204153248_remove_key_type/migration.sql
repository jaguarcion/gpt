/*
  Warnings:

  - You are about to drop the column `type` on the `keys` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_keys" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "usedAt" DATETIME,
    "usedByEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subscriptionId" INTEGER,
    CONSTRAINT "keys_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_keys" ("code", "createdAt", "id", "status", "subscriptionId", "usedAt", "usedByEmail") SELECT "code", "createdAt", "id", "status", "subscriptionId", "usedAt", "usedByEmail" FROM "keys";
DROP TABLE "keys";
ALTER TABLE "new_keys" RENAME TO "keys";
CREATE UNIQUE INDEX "keys_code_key" ON "keys"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
