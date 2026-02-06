-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_subscriptions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextActivationDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "activationsCount" INTEGER NOT NULL DEFAULT 0,
    "lifetimeActivations" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_subscriptions" ("activationsCount", "createdAt", "email", "id", "nextActivationDate", "note", "startDate", "status", "type") SELECT "activationsCount", "createdAt", "email", "id", "nextActivationDate", "note", "startDate", "status", "type" FROM "subscriptions";
DROP TABLE "subscriptions";
ALTER TABLE "new_subscriptions" RENAME TO "subscriptions";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
