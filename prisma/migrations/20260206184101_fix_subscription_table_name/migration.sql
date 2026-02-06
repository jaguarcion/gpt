/*
  Warnings:

  - You are about to drop the `Subscription` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Subscription";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activationsCount" INTEGER NOT NULL DEFAULT 0,
    "lifetimeActivations" INTEGER NOT NULL DEFAULT 0,
    "nextActivationDate" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

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
